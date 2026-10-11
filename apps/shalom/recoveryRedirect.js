// URLs estáveis para recuperação de senha em SPAs.
export function shalomRecoveryRedirect(base,githubPages=false){
  const url=String(base||"").replace(/\/+$/,"");
  return url+(githubPages?"/?recuperar_senha=1":"/redefinir-senha");
}
export function shalomRecoveryRequested(search,githubPages=false){
  return githubPages && new URLSearchParams(search).get("recuperar_senha")==="1";
}
