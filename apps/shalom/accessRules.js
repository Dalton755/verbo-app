// Regras puras para exibição do estado de pagamento; nunca substituem
// shalom.tem_assinatura_vigente() no servidor.
export function periodoPagoVigente(status,validadeAte,instante=Date.now()){
  if(!["active","canceled"].includes(status) || !validadeAte)return false;
  const vencimento=Date.parse(validadeAte);
  return Number.isFinite(vencimento) && vencimento>instante;
}
export function acessoSimuladoVencido(search,habilitado){
  if(!habilitado)return false;
  const valor=new URLSearchParams(search).get("simular_vencimento")||"";
  // Links antigos codificaram o # do HashRouter como %23 dentro da query.
  // Ex.: ?simular_vencimento=1%23/estante => "1#/estante".
  return valor==="1" || /^1#\//.test(valor);
}
