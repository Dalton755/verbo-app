// Shalom — checkout mensal PIX Asaas, deliberadamente apenas SANDBOX.
// A ativação em produção exige revisão explícita e outro fluxo de implantação.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = [
  "https://shalom.nethanel.com.br",
  "https://shalom-leitor-git-feature-shalom-456a68-dalton-rocha-s-projects.vercel.app",
];
function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[1],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

const ASAAS_BASE = "https://api-sandbox.asaas.com/v3";
async function asaasRequest(
  apiKey: string, path: string, init: { method?: string; body?: unknown } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(ASAAS_BASE + path, {
      method: init.method || "GET",
      headers: {
        "access_token": apiKey,
        "accept": "application/json",
        "content-type": "application/json",
        "User-Agent": "Nethanel-Shalom/0.1 (sandbox)",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.errors?.[0]?.description || result?.message ||
        "O Asaas não conseguiu concluir a solicitação.";
      throw new Error(String(message).slice(0, 250));
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function validCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (![11, 14].includes(digits.length) || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const base = digits.slice(0, length);
    let factor = length === 9 ? 10 : length === 10 ? 11 : length === 12 ? 5 : 6;
    let total = 0;
    for (const n of base) {
      total += Number(n) * factor;
      factor = factor === 2 ? 9 : factor - 1;
    }
    const rest = (total * 10) % 11;
    return (rest === 10 ? 0 : rest) === Number(digits[length]);
  };
  return digits.length === 11 ? check(9) && check(10) : check(12) && check(13);
}

function billingDate() {
  // O cliente brasileiro deve enxergar o vencimento no horário local, não UTC.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function validPaymentLink(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return parsed.protocol === "https:" &&
      (host === "asaas.com" || host.endsWith(".asaas.com") ||
       host === "asaas.com.br" || host.endsWith(".asaas.com.br"))
      ? parsed.href : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { error: "METODO_INVALIDO" }, 405);

  // Não aceitar ambiente production nesta versão, nem se o segredo for inserido por engano.
  const key = Deno.env.get("ASAAS_API_KEY_SANDBOX");
  if (!key || Deno.env.get("SHALOM_CHECKOUT_SANDBOX_ENABLED") !== "true") {
    return json(req, {
      error: "INTEGRACAO_EM_PREPARACAO",
      message: "Assinaturas de teste ainda não foram ativadas. Nenhuma cobrança foi criada.",
    }, 503);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return json(req, { error: "SERVICO_NAO_CONFIGURADO" }, 503);

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json(req, { error: "SESSAO_NECESSARIA" }, 401);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.id) return json(req, { error: "SESSAO_INVALIDA" }, 401);

  let body: { nome?: string; cpfCnpj?: string };
  try { body = await req.json(); } catch { return json(req, { error: "DADOS_INVALIDOS" }, 400); }

  const nome = String(body.nome ?? user.user_metadata?.full_name ?? "").trim().slice(0, 120);
  const documento = String(body.cpfCnpj ?? "").replace(/\D/g, "");
  if (nome.length < 3 || !validCpfCnpj(documento)) {
    return json(req, { error: "DADOS_INVALIDOS", message: "Informe seu nome e um CPF ou CNPJ válido." }, 400);
  }

  const table = admin.schema("shalom").from("assinaturas");
  const { data: current, error: dbError } = await table
    .select("usuario_id,status,validade_ate,asaas_customer_id,asaas_subscription_id,asaas_ambiente")
    .eq("usuario_id", user.id).maybeSingle();
  if (dbError) return json(req, { error: "BANCO_INDISPONIVEL" }, 503);
  if (current?.asaas_ambiente === "production") {
    return json(req, { error: "ASSINATURA_OUTRO_AMBIENTE" }, 409);
  }
  if (current?.status === "active" && current?.validade_ate &&
      new Date(current.validade_ate).getTime() > Date.now()) {
    return json(req, { status: "active", message: "Sua assinatura já está ativa." });
  }

  try {
    let customerId = current?.asaas_customer_id as string | undefined;
    let subscriptionId = current?.asaas_subscription_id as string | undefined;
    if (!customerId) {
      const customer = await asaasRequest(key, "/customers", {
        method: "POST",
        body: { name: nome, cpfCnpj: documento, email: user.email,
          externalReference: "shalom:" + user.id, notificationDisabled: true },
      });
      customerId = customer.id;
      if (!customerId) throw new Error("Não recebemos a identificação do cliente no Asaas.");
      const { error } = await table.upsert({
        usuario_id: user.id, asaas_customer_id: customerId, asaas_ambiente: "sandbox",
        status: "pending", valor_mensal: 4.99, ciclo: "MONTHLY", metodo: "PIX",
      }, { onConflict: "usuario_id" });
      if (error) throw error;
    }

    if (!subscriptionId) {
      const subscription = await asaasRequest(key, "/subscriptions", {
        method: "POST",
        body: { customer: customerId, billingType: "PIX", value: 4.99,
          nextDueDate: billingDate(), cycle: "MONTHLY",
          description: "Shalom — biblioteca e leitura inteligente",
          externalReference: "shalom:" + user.id },
      });
      subscriptionId = subscription.id;
      if (!subscriptionId) throw new Error("Não foi possível criar a assinatura de teste.");
      const { error } = await table.upsert({
        usuario_id: user.id, asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId, asaas_ambiente: "sandbox",
        status: "pending", valor_mensal: 4.99, ciclo: "MONTHLY", metodo: "PIX",
      }, { onConflict: "usuario_id" });
      if (error) throw error;
    }

    const payments = await asaasRequest(
      key, "/subscriptions/" + encodeURIComponent(subscriptionId) + "/payments?limit=10"
    );
    const pending = (Array.isArray(payments.data) ? payments.data : []).find(
      (p: { status: string; invoiceUrl?: string }) =>
        ["PENDING", "OVERDUE"].includes(p.status) && validPaymentLink(p.invoiceUrl)
    );
    if (!pending) {
      return json(req, {
        status: "pending", message: "Assinatura de teste criada. A primeira cobrança está sendo preparada.",
      }, 202);
    }
    const link = validPaymentLink(pending.invoiceUrl);
    await table.update({ ultimo_pagamento_id: pending.id, pagamento_url: link,
      proximo_vencimento: pending.dueDate || null, atualizado_em: new Date().toISOString()
    }).eq("usuario_id", user.id);
    return json(req, {
      status: "pending", ambiente: "sandbox", invoiceUrl: link,
      message: "Cobrança de teste criada. Pague somente no ambiente Sandbox.",
    });
  } catch (error) {
    // Não registrar CPF, API key ou dados financeiros pessoais em logs.
    console.error("Falha no checkout Shalom Sandbox:", error instanceof Error ? error.name : "unknown");
    return json(req, { error: "FALHA_CHECKOUT", message: "Não foi possível preparar o Pix de teste. Tente novamente mais tarde." }, 502);
  }
});
