import test from "node:test";
import assert from "node:assert/strict";
import {periodoPagoVigente,acessoSimuladoVencido} from "../apps/shalom/accessRules.js";

const hora=Date.parse("2026-10-10T12:00:00Z");

test("assinatura ativa antes do vencimento",()=>{
 assert.equal(periodoPagoVigente("active","2026-11-09T00:00:00Z",hora),true);
});
test("cancelamento conserva o período já pago",()=>{
 assert.equal(periodoPagoVigente("canceled","2026-11-09T00:00:00Z",hora),true);
});
test("assinatura vence exatamente na validade",()=>{
 const validade="2026-11-09T00:00:00Z";
 assert.equal(periodoPagoVigente("active",validade,Date.parse(validade)),false);
 assert.equal(periodoPagoVigente("canceled",validade,Date.parse(validade)),false);
});
test("pagamento pendente não concede acesso premium",()=>{
 assert.equal(periodoPagoVigente("pending","2026-11-09T00:00:00Z",hora),false);
 assert.equal(periodoPagoVigente("past_due","2026-11-09T00:00:00Z",hora),false);
 assert.equal(periodoPagoVigente("inactive",null,hora),false);
});
test("dados de validade inválidos são negados",()=>{
 assert.equal(periodoPagoVigente("active","erro",hora),false);
 assert.equal(periodoPagoVigente("active",null,hora),false);
});
test("simulação nunca se ativa fora da prévia",()=>{
 assert.equal(acessoSimuladoVencido("?simular_vencimento=1",false),false);
 assert.equal(acessoSimuladoVencido("?simular_vencimento=1",true),true);
 assert.equal(acessoSimuladoVencido("?simular_vencimento=0",true),false);
});
