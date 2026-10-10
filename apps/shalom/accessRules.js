// Regras puras para exibição do estado de pagamento; nunca substituem
// shalom.tem_assinatura_vigente() no servidor.
export function periodoPagoVigente(status,validadeAte,instante=Date.now()){
  if(!["active","canceled"].includes(status) || !validadeAte)return false;
  const vencimento=Date.parse(validadeAte);
  return Number.isFinite(vencimento) && vencimento>instante;
}
export function acessoSimuladoVencido(search,habilitado){
  if(!habilitado)return false;
  return new URLSearchParams(search).get("simular_vencimento")==="1";
}
