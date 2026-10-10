import React,{createContext,useCallback,useContext,useEffect,useState} from "react";
import {useAuth} from "./auth.jsx";
import {supabase} from "./supabase.js";

const AccessContext=createContext(null);

/**
 * Fonte de verdade: shalom.tem_assinatura_vigente(), validada pelo Postgres.
 * Não confiamos no relógio local nem no localStorage para liberar a leitura.
 * Falhas de rede não devem ser interpretadas como vencimento.
 */
export function ShalomAccessProvider({children}){
  const {user}=useAuth();
  const [check,setCheck]=useState({userId:null,status:"loading"});
  const refresh=useCallback(async()=>{
    if(!user?.id){
      setCheck({userId:null,status:"inactive"});
      return;
    }
    const uid=user.id;
    try{
      const {data,error}=await supabase.rpc("tem_assinatura_vigente");
      if(error)throw error;
      setCheck({userId:uid,status:data===true?"active":"inactive"});
    }catch{
      setCheck({userId:uid,status:"error"});
    }
  },[user?.id]);
  useEffect(()=>{
    if(!user?.id){setCheck({userId:null,status:"inactive"});return;}
    setCheck({userId:user.id,status:"loading"});
    refresh();
    const onFocus=()=>refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")refresh()};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    // Atualiza até mesmo se o usuário permanecer no leitor no instante do vencimento.
    const timer=window.setInterval(refresh,60000);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[user?.id,refresh]);
  const status=check.userId===user?.id?check.status:"loading";
  return <AccessContext.Provider value={{status,active:status==="active",refresh}}>
    {children}
  </AccessContext.Provider>;
}
export function useShalomAccess(){
  const value=useContext(AccessContext);
  if(!value)throw new Error("ShalomAccessProvider ausente");
  return value;
}
