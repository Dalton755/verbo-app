const cache = new Map();

export function buscarLivroCache(id) {
  if (!id) {
    return null;
  }

  return cache.get(id) ?? null;
}

export function salvarLivroCache(
  id,
  dados,
) {
  if (
    !id ||
    !dados
  ) {
    return;
  }

  cache.set(
    id,
    dados,
  );
}

export function limparLivroCache(id) {
  if (!id) {
    return;
  }

  cache.delete(id);
}