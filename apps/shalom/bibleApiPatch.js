// O Shalom ainda não disponibiliza a base local Almeida 1911 no schema shalom.
// Publicamos apenas versões atendidas pela Edge Function bible-passage.
// Aplicar somente no build do Shalom, mantendo o leitor VERBO intacto.
export function patchShalomBibleApi(source) {
  const missing = [
    /export const VERSAO_BIBLICA_PADRAO\s*=\s*"ALM1911_ATUAL";/,
    /    \{\s*id: "ALM1911_ATUAL",[\s\S]*?    \},\s*(?=    \{\s*id: "BLIVRE")/,
    /"verbo:traducao-biblica"/,
  ];
  for (const needle of missing) {
    if (!needle.test(source)) {
      throw new Error("Shalom: bibleApi compartilhada mudou. Verificar integração antes de publicar.");
    }
  }
  return source
    .replace(missing[0], 'export const VERSAO_BIBLICA_PADRAO = "BLIVRE";')
    .replace(missing[1], "")
    .replace(missing[2], '"shalom:traducao-biblica"');
}
