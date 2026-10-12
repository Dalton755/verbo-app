import test from "node:test";
import assert from "node:assert/strict";
import {interpretarEstornoAsaas} from "../apps/shalom/refundStatus.js";

test("estorno CANCELLED não significa reembolso concluído nem bloqueio",()=>{
 const r=interpretarEstornoAsaas({status:"RECEIVED",refundStatuses:["CANCELLED"],refundLookupAvailable:true});
 assert.equal(r.cancelado,true);
 assert.equal(r.concluido,false);
 assert.equal(r.pendente,false);
 assert.equal(r.historico,"Cancelado");
 assert.match(r.mensagem,/tentativa de estorno CANCELADA/);
 assert.match(r.mensagem,/pagamento continua recebido/);
});

test("estorno PENDING ainda não autoriza conclusão",()=>{
 const r=interpretarEstornoAsaas({status:"RECEIVED",refundStatuses:["PENDING"]});
 assert.equal(r.pendente,true);
 assert.equal(r.concluido,false);
 assert.match(r.mensagem,/em processamento/);
});

test("estorno DONE concluído é prioritário mesmo com tentativa CANCELLED antiga",()=>{
 const r=interpretarEstornoAsaas({status:"RECEIVED",refundStatuses:["CANCELLED","DONE"]});
 assert.equal(r.concluido,true);
 assert.match(r.mensagem,/estorno concluído/);
});

test("histórico indisponível não é interpretado como ausência de estorno",()=>{
 const r=interpretarEstornoAsaas({status:"RECEIVED",refundStatuses:[],refundLookupAvailable:false});
 assert.match(r.mensagem,/Não foi possível consultar/);
});

test("sem estorno e consulta disponível não indica erro no webhook",()=>{
 const r=interpretarEstornoAsaas({status:"RECEIVED",refundStatuses:[],refundLookupAvailable:true});
 assert.match(r.mensagem,/não apresenta uma solicitação/);
});
