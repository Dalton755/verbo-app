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

// O Asaas devolve códigos e mensagens úteis de validação. Guardamos apenas
// código + etapa + HTTP nos logs, nunca documento, token ou payload pessoal.
class AsaasRequestError extends Error {
  constructor(
    public httpStatus: number,
    public providerCode: string,
    public safeDescription: string,
  ) {
    super("Asaas Sandbox retornou HTTP " + httpStatus);
    this.name = "AsaasRequestError";
  }
}

function sanitizedDescription(value: unknown) {
  // Não repassar para o browser campos pessoais contidos em eventuais erros.
  return String(value || "A operação não foi aceita pelo Asaas.")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail protegido]")
    .replace(/\b\d{6,}\b/g, "[número protegido]")
    .slice(0, 240);
}
function cleanProviderCode(value: unknown) {
  return /^[a-zA-Z0-9_-]{1,70}$/.test(String(value || ""))
    ? String(value) : "unknown_error";
}
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
        "A solicitação não foi aceita pelo Asaas.";
      throw new AsaasRequestError(
        response.status,
        cleanProviderCode(result?.errors?.[0]?.code),
        sanitizedDescription(message),
      );
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
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const campo = (tipo: string) => partes.find(p => p.type === tipo)?.value || "";
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
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

  let body: { action?: string; nome?: string; cpfCnpj?: string };
  try { body = await req.json(); } catch { return json(req, { error: "DADOS_INVALIDOS" }, 400); }

  const table = admin.schema("shalom").from("assinaturas");
  if (body.action === "get-pix") {
    // Recupera apenas a cobrança registrada para o titular autenticado.
    // Nunca aceita ID da cobrança informado pelo navegador.
    const { data: own, error: ownError } = await table
      .select("asaas_ambiente,asaas_customer_id,asaas_subscription_id,ultimo_pagamento_id,status")
      .eq("usuario_id", user.id).maybeSingle();
    if (ownError) return json(req, { error: "BANCO_INDISPONIVEL" }, 503);
    if (!own || own.asaas_ambiente !== "sandbox" ||
        !own.ultimo_pagamento_id || !own.asaas_subscription_id ||
        !own.asaas_customer_id) {
      return json(req, { error: "COBRANCA_NAO_ENCONTRADA", message: "Nenhuma cobrança Pix de teste está vinculada à sua conta." }, 404);
    }
    try {
      const payment = await asaasRequest(key,
        "/payments/" + encodeURIComponent(own.ultimo_pagamento_id));
      if (payment.id !== own.ultimo_pagamento_id ||
          payment.customer !== own.asaas_customer_id ||
          payment.subscription !== own.asaas_subscription_id ||
          !["PIX","BOLETO","UNDEFINED"].includes(payment.billingType)) {
        return json(req, { error: "COBRANCA_INCONSISTENTE" }, 409);
      }
      if (!["PENDING","OVERDUE"].includes(payment.status)) {
        return json(req, { status: payment.status, available: false,
          message: "Esta cobrança já não está aguardando pagamento." });
      }
      const qr = await asaasRequest(key,
        "/payments/" + encodeURIComponent(own.ultimo_pagamento_id) + "/pixQrCode");
      const image = typeof qr.encodedImage === "string" &&
        qr.encodedImage.length < 150000 &&
        /^[A-Za-z0-9+/=]+$/.test(qr.encodedImage) ? qr.encodedImage : null;
      const payload = typeof qr.payload === "string" && qr.payload.length <= 4096
        ? qr.payload : null;
      if (!image && !payload) {
        return json(req, { status: "pending", available: false,
          message: "O Asaas ainda não disponibilizou um QR Code Pix. Você pode abrir a cobrança de teste." });
      }
      return json(req, { status: "pending", available: true,
        encodedImage: image, payload,
        expirationDate: typeof qr.expirationDate === "string" ? qr.expirationDate : null,
        ambiente: "sandbox" });
    } catch (error) {
      console.error("Falha na recuperação do QR Code Shalom Sandbox", {
        httpStatus: error instanceof AsaasRequestError ? error.httpStatus : null,
        providerCode: error instanceof AsaasRequestError ? error.providerCode : "other",
      });
      return json(req, { status: "pending", available: false,
        message: "QR Code Pix indisponível no Asaas Sandbox. Confira a chave Pix da conta ou abra a cobrança de teste." });
    }
  }
  if (body.action && body.action !== "create") {
    return json(req, { error: "ACAO_INVALIDA" }, 400);
  }

  const nome = String(body.nome ?? user.user_metadata?.full_name ?? "").trim().slice(0, 120);
  const documento = String(body.cpfCnpj ?? "").replace(/\D/g, "");
  if (nome.length < 3 || !validCpfCnpj(documento)) {
    return json(req, { error: "DADOS_INVALIDOS", message: "Informe seu nome e um CPF ou CNPJ válido." }, 400);
  }

  const { data: current, error: dbError } = await table
    .select("usuario_id,status,validade_ate,asaas_customer_id,asaas_subscription_id,asaas_ambiente")
    .eq("usuario_id", user.id).maybeSingle();
  if (dbError) return json(req, { error: "BANCO_INDISPONIVEL" }, 503);
  if (current?.asaas_ambiente === "production") {
    return json(req, { error: "ASSINATURA_OUTRO_AMBIENTE" }, 409);
  }
  if (current?.validade_ate &&
      new Date(current.validade_ate).getTime() > Date.now() &&
      ["active","canceled"].includes(current.status)) {
    return json(req, {
      status: current.status,
      message: current.status==="canceled"
        ? "Sua renovação foi cancelada. O acesso já pago continua até o vencimento."
        : "Sua assinatura já está ativa."
    });
  }

  let etapa = "cliente";
  try {
    let customerId = current?.asaas_customer_id as string | undefined;
    // Uma recorrência já cancelada no Asaas NÃO pode ser reutilizada.
    // Após expirar o período pago, uma nova contratação precisa de um novo ID.
    let subscriptionId = current?.status==="canceled" ? undefined
      : current?.asaas_subscription_id as string | undefined;
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
        status: "pending", valor_mensal: 5.99, ciclo: "MONTHLY", metodo: "PIX",
      }, { onConflict: "usuario_id" });
      if (error) throw error;
    }

    etapa = "assinatura";
    if (!subscriptionId) {
      // Consulta pontual antes de criar evita assinaturas duplicadas após
      // timeout/sucesso remoto sem persistência local.
      const ref = "shalom:" + user.id;
      const existentes = await asaasRequest(key,
        "/subscriptions?customer=" + encodeURIComponent(customerId) +
        "&externalReference=" + encodeURIComponent(ref) + "&limit=10");
      const encontrada = Array.isArray(existentes.data)
        ? existentes.data.find((a: { id?: string; customer?: string; externalReference?: string; status?: string }) =>
            a.customer === customerId && a.externalReference === ref && a.status !== "INACTIVE") : null;
      subscriptionId = encontrada?.id;
      if (!subscriptionId) {
        const subscription = await asaasRequest(key, "/subscriptions", {
          method: "POST",
          body: { customer: customerId, billingType: "PIX", value: 5.99,
            nextDueDate: billingDate(), cycle: "MONTHLY",
            description: "Shalom — biblioteca e leitura inteligente",
            externalReference: ref },
        });
        subscriptionId = subscription.id;
      }
      if (!subscriptionId) throw new Error("Não foi possível identificar a assinatura de teste.");
      const { error } = await table.upsert({
        usuario_id: user.id, asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId, asaas_ambiente: "sandbox",
        status: "pending", valor_mensal: 5.99, ciclo: "MONTHLY", metodo: "PIX",
        ultimo_pagamento_id: null, pagamento_url: null, proximo_vencimento: null,
        cancelada_em: null,
      }, { onConflict: "usuario_id" });
      if (error) throw error;
    }

    etapa = "cobranca";
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
    if (error instanceof AsaasRequestError) {
      // Campos seguros de diagnóstico; nunca imprimir JSON da API nem CPF.
      console.error("Falha no checkout Shalom Sandbox", {
        etapa, httpStatus: error.httpStatus, providerCode: error.providerCode,
      });
      return json(req, {
        error: "ASAAS_REJEITOU_OPERACAO", etapa,
        providerCode: error.providerCode,
        message: error.safeDescription,
      }, 502);
    }
    console.error("Falha no checkout Shalom Sandbox", {
      etapa, tipo: error instanceof Error ? error.name : "unknown",
    });
    return json(req, {
      error: "FALHA_CHECKOUT", etapa,
      message: "Falha ao preparar o pagamento de teste. Tente novamente.",
    }, 502);
  }
});
