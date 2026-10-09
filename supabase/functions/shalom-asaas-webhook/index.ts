// Shalom — webhook PIX Asaas SANDBOX.
// A autenticação NÃO utiliza JWT: Asaas assina cada POST com asaas-access-token.
// A função é fechada quando o token seguro não estiver configurado.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function tokenIgual(recebido: string, esperado: string) {
  // Comparação sem saída antecipada por caractere, reduzindo variação temporal.
  if (recebido.length !== esperado.length || !esperado) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferenca === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const authToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN_SANDBOX");
  if (!authToken || authToken.length < 32) {
    return json({ error: "WEBHOOK_NAO_CONFIGURADO" }, 503);
  }
  const recebida = req.headers.get("asaas-access-token") || "";
  if (!tokenIgual(recebida, authToken)) return json({ error: "NAO_AUTORIZADO" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return json({ error: "SERVICO_NAO_CONFIGURADO" }, 503);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
    if (!payload || typeof payload !== "object" || typeof payload.id !== "string" ||
        typeof payload.event !== "string") {
      return json({ error: "EVENTO_INVALIDO" }, 400);
    }
  } catch { return json({ error: "JSON_INVALIDO" }, 400); }

  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.schema("shalom").rpc(
    "registrar_evento_pagamento_asaas", {
      p_evento: payload,
      p_ambiente: "sandbox",
    }
  );
  if (error) {
    // O Asaas repetirá o evento; não reconhecer como recebido se o banco falhar.
    console.error("Falha em webhook Shalom:", error.code ?? "database_error");
    return json({ error: "EVENTO_NAO_PROCESSADO" }, 503);
  }
  return json({ received: true, detail: data?.reason || data?.event || "ok" });
});
