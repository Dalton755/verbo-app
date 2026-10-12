// Ajustes apenas durante a compilação do leitor Shalom, sem tocar no VERBO.
export function patchShalomBookCache(source){
  let code=source;
  const initial="buscarLivroCache(id)";
  if(code.split(initial).length-1!==1)throw new Error("Cache Shalom: busca não encontrada");
  code=code.replace(initial,"buscarLivroCache(user?.id, id)");
  const save=/salvarLivroCache\(\s*id,/g;
  const count=[...code.matchAll(save)].length;
  if(count!==2)throw new Error("Cache Shalom: gravações esperadas=2, encontradas="+count);
  code=code.replace(save,"salvarLivroCache(\n                    user?.id,\n                    id,");
  return code;
}
