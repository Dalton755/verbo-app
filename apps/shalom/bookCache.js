// Cache isolado do leitor Shalom. Jamais partilhar conteúdo entre contas.
const livros=new Map();
function chave(usuarioId,livroId){
  if(!usuarioId||!livroId)return null;
  return String(usuarioId)+":"+String(livroId);
}
export function buscarLivroCache(usuarioId,livroId){
  const id=chave(usuarioId,livroId);
  return id ? (livros.get(id)??null) : null;
}
export function salvarLivroCache(usuarioId,livroId,dados){
  const id=chave(usuarioId,livroId);
  if(id && dados)livros.set(id,dados);
}
export function limparCacheShalom(){livros.clear();}
