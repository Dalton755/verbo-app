import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const api=readFileSync(new URL("../supabase/functions/shalom-checkout/index.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../apps/shalom/App.jsx",import.meta.url),"utf8");
test("diagnóstico de cobrança exige identidade e identifica pagamento pelo banco, nunca pelo cliente",()=>{
 const auth=api.indexOf("admin.auth.getUser(token)");
 const block=api.indexOf('if (body.action === "get-payment-status")');
 assert.ok(auth>0 && block>auth);
 assert.match(api.slice(block),/eq\("usuario_id", user.id\)/);
 const provider=api.indexOf('"/payments/" + encodeURIComponent(own.ultimo_pagamento_id)',block);
 assert.ok(provider>block);
 assert.match(api.slice(block),/payment\.customer !== own\.asaas_customer_id/);
 assert.match(api.slice(block),/payment\.subscription !== own\.asaas_subscription_id/);
});
test("retorno do diagnóstico limita status e não expõe dados pessoais nem API key",()=>{
 const block=api.slice(api.indexOf('if (body.action === "get-payment-status")'),api.indexOf('if (body.action === "get-pix")'));
 assert.match(block,/paymentSuffix: String\(payment.id\)\.slice\(-6\)/);
 assert.match(block,/refundStatuses: refunds/);
 assert.doesNotMatch(block,/return json\(req, payment\)/);
 assert.match(api,/ASAAS_API_KEY_SANDBOX/);
 assert.match(api,/https:\/\/api-sandbox\.asaas\.com\/v3/);
});
test("UI da consulta não pode alterar assinatura",()=>{
 assert.match(ui,/body:\{action:"get-payment-status"\}/);
 assert.match(ui,/sem alterar assinatura nem pagamento/);
 assert.match(ui,/Verificar situação do pagamento/);
});