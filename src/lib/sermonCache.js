const cache = new Map();

export function buscarSermaoCache(id) {
  if (!id) return null;

  return cache.get(id) ?? null;
}

export function salvarSermaoCache(
  id,
  dados,
) {
  if (!id || !dados) return;

  cache.set(id, dados);
}

export function limparSermaoCache(id) {
  if (!id) return;

  cache.delete(id);
}