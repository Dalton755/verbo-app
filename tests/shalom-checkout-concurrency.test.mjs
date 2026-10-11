import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const checkout=readFileSync(new URL("../supabase/functions/shalom-checkout/index.ts",import.meta.url),"utf8");
test("checkout reserva trava do titular antes de consultar a assinatura",()=>{
 const reserved=checkout.indexOf('.rpc("checkout_acquire"');
 const subscription=checkout.indexOf('const { data: current, error: dbError }');
 assert.ok(reserved>0 && subscription>reserved);
 assert.match(checkout,/checkoutReserved !== true/);
 assert.match(checkout,/CHECKOUT_EM_ANDAMENTO/);
});
test("trava é liberada em finally, inclusive após falha ou retorno antecipado",()=>{
 assert.match(checkout,/\} finally \{[\s\S]*\.rpc\("checkout_release"/);
});
test("cliente já criado é conciliado pelo identificador antes de novo POST",()=>{
 const query=checkout.indexOf('"/customers?externalReference="');
 const post=checkout.indexOf('const customer = existing || await asaasRequest(key, "/customers"');
 assert.ok(query>0 && post>query);
 assert.match(checkout,/c\.externalReference === reference/);
});
test("cobrança só é apresentada depois que seu identificador é salvo",()=>{
 assert.match(checkout,/if \(savePaymentError\) throw/);
});
test("checkout continua sendo exclusivo do Asaas Sandbox",()=>{
 assert.match(checkout,/const ASAAS_BASE = "https:\/\/api-sandbox\.asaas\.com\/v3"/);
 assert.doesNotMatch(checkout,/https:\/\/api\.asaas\.com\/v3/);
});
