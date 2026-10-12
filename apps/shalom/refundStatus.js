// Shalom: interpreta estados informados pelo Asaas, sem alterar acesso ou cobrança.
const legendas={
  PENDING:"Em processamento",
  IN_PROGRESS:"Em processamento",
  REFUND_IN_PROGRESS:"Em processamento",
  CANCELLED:"Cancelado",
  DONE:"Concluído",
  REFUNDED:"Concluído",
};
export function interpretarEstornoAsaas(dados){
  const statusPagamento=dados?.status;
  const estados=Array.isArray(dados?.refundStatuses)
    ?dados.refundStatuses.filter(s=>typeof s==="string").slice(0,20):[];
  const concluido=statusPagamento==="REFUNDED" ||
    Boolean(dados?.refundDate) || estados.some(s=>s==="DONE"||s==="REFUNDED");
  const pendente=statusPagamento==="REFUND_IN_PROGRESS" ||
    estados.some(s=>s==="PENDING"||s==="IN_PROGRESS"||s==="REFUND_IN_PROGRESS");
  const cancelado=estados.includes("CANCELLED");
  let mensagem;
  if(concluido){
    mensagem="O Asaas registra um estorno concluído. Se a assinatura ainda estiver ativa, precisamos verificar a sincronização.";
  }else if(pendente){
    mensagem="O Asaas informa que há um estorno em processamento. Não solicite outro estorno.";
  }else if(cancelado){
    mensagem="O Asaas registra uma tentativa de estorno CANCELADA. O dinheiro não foi devolvido por essa tentativa; o pagamento continua recebido e o Shalom mantém o acesso.";
  }else if(dados?.refundLookupAvailable===false){
    mensagem="Não foi possível consultar todo o histórico de estornos. A situação ainda precisa ser verificada.";
  }else{
    mensagem="O Asaas não apresenta uma solicitação de estorno para esta cobrança.";
  }
  return {mensagem,historico:estados.map(s=>legendas[s]||s).join(", "),cancelado,concluido,pendente};
}
