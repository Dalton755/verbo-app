// Shalom · cancelamento da assinatura somente no Asaas Sandbox.
// Após encerrar a recorrência, o acesso já pago permanece até validade_ate.
// NÃO migrar para produção sem revisão e autorização explícita.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGEM_PREVIA =
  "https://shalom-leitor-git-feature-shalom-456a68-dalton-rocha-s-projects.vercel.app";
const ALLOWED_ORIGINS = [ORIGEM_PREVIA, "https://dalton755.github.io"];
function headers(req: Request) {
  const origem = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origem) ? origem : ORIGEM_PREVIA,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function reply(req: Request, data: Record<string, unknown>, status=200) {
  return new Response(JSON.stringify(data),{
    status,headers:{...headers(req),"Content-Type":"application/json; charset=utf-8"}
  });
}

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:headers(req)});
  if (req.method!=="POST") return reply(req,{error:"METODO_INVALIDO"},405);

  // Dois bloqueios do próprio Sandbox: nunca usar credenciais reais.
  const apiKey=Deno.env.get("ASAAS_API_KEY_SANDBOX");
  if (!apiKey || Deno.env.get("SHALOM_CHECKOUT_SANDBOX_ENABLED")!=="true") {
    return reply(req,{error:"TESTES_DESABILITADOS"},503);
  }
  const url=Deno.env.get("SUPABASE_URL");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return reply(req,{error:"SERVICO_INDISPONIVEL"},503);

  let body: { confirmar?: boolean };
  try {body=await req.json();}catch{return reply(req,{error:"JSON_INVALIDO"},400);}
  if(body?.confirmar!==true){
    return reply(req,{error:"CONFIRMACAO_OBRIGATORIA"},400);
  }

  const jwt=req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if(!jwt) return reply(req,{error:"LOGIN_NECESSARIO"},401);
  const admin=createClient(url,secret,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:authError}=await admin.auth.getUser(jwt);
  if(authError || !user?.id) return reply(req,{error:"SESSAO_INVALIDA"},401);

  const table=admin.schema("shalom").from("assinaturas");
  const {data:own,error:ownError}=await table
    .select("status,validade_ate,asaas_ambiente,asaas_subscription_id,cancelada_em")
    .eq("usuario_id",user.id).maybeSingle();
  if(ownError) return reply(req,{error:"BANCO_INDISPONIVEL"},503);
  if(!own || own.asaas_ambiente!=="sandbox"){
    return reply(req,{error:"ASSINATURA_NAO_LOCALIZADA"},404);
  }
  if(own.status==="canceled"){
    return reply(req,{
      status:"canceled",validade_ate:own.validade_ate,
      message:"A renovação já está cancelada. O período pago continua disponível."
    });
  }
  const subscriptionId=own.asaas_subscription_id;
  if(!subscriptionId || !/^sub_[a-zA-Z0-9_-]+$/.test(subscriptionId)){
    return reply(req,{error:"ASSINATURA_ASAAS_NAO_LOCALIZADA"},409);
  }

  // O Asaas cancela cobranças futuras/pedentes, mas mantém cobranças pagas.
  // A chamada destrutiva ocorre apenas APÓS confirmar=true pelo usuário.
  try {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    let response: Response;
    try{
      response=await fetch(
        "https://api-sandbox.asaas.com/v3/subscriptions/"+encodeURIComponent(subscriptionId),
        {
          method:"DELETE",
          headers:{
            "access_token":apiKey,
            "accept":"application/json",
            "User-Agent":"Nethanel-Shalom/0.1 (sandbox)"
          },
          signal:controller.signal
        }
      );
    }finally{clearTimeout(timer);}

    // 404 com ID pertencente à assinatura do próprio usuário indica que já
    // não existe recorrência ativa no provedor (ex. cancelada no painel).
    if(!response.ok && response.status!==404){
      console.error("Shalom Sandbox: Asaas recusou cancelamento",{
        status:response.status
      });
      return reply(req,{
        error:"ASAAS_CANCELAMENTO_RECUSADO",
        message:"Não foi possível cancelar a recorrência no Asaas Sandbox. Tente novamente."
      },502);
    }

    const {data:saved,error:saveError}=await table.update({
      status:"canceled",
      cancelada_em:new Date().toISOString(),
      asaas_subscription_encerrada_id:subscriptionId,
      proximo_vencimento:null,
      pagamento_url:null,
      atualizado_em:new Date().toISOString(),
      // NÃO reduzir nem zerar validade_ate, mesmo quando houver
      // cobranças pendentes removidas pelo Asaas.
    })
    .eq("usuario_id",user.id)
    .eq("asaas_subscription_id",subscriptionId)
    .neq("status","canceled")
    .select("status,validade_ate,cancelada_em").maybeSingle();
    if(saveError || !saved){
      // Em nova tentativa o DELETE 404 permite reconciliar a mesma assinatura.
      console.error("Shalom Sandbox: recorrência cancelada, atualização local pendente");
      return reply(req,{
        error:"CANCELAMENTO_AGUARDANDO_SINCRONIZACAO",
        message:"A recorrência foi encerrada no Asaas, mas o Shalom ainda precisa atualizar o status. Tente novamente."
      },503);
    }
    return reply(req,{
      status:"canceled",validade_ate:saved.validade_ate,
      message:"Assinatura cancelada. Nenhuma nova cobrança recorrente será gerada; acesso pago preservado até a validade."
    });
  }catch(error){
    console.error("Shalom Sandbox: falha ao cancelar",error instanceof Error?error.name:"unknown");
    return reply(req,{
      error:"CANCELAMENTO_NAO_CONCLUIDO",
      message:"Não conseguimos confirmar o cancelamento no Asaas. Tente novamente."
    },502);
  }
});
