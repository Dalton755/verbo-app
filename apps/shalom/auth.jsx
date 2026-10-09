import React,{createContext,useContext,useEffect,useState} from "react";
import {supabase} from "./supabase.js";
const Context=createContext(null);
export function ShalomAuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted){setUser(data?.session?.user??null);setLoading(false)}}).catch(()=>mounted&&setLoading(false));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(mounted){setUser(session?.user??null);setLoading(false)}});
 return ()=>{mounted=false;subscription.unsubscribe()};},[]);
 return <Context.Provider value={{user,loading,supabase}}>{children}</Context.Provider>
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error("ShalomAuthProvider não configurado.");return value}
