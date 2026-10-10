/** Guardas independentes da interface. O banco mantém a validação definitiva. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_FILES = 150;

export function validateIncomingFile(file) {
  if (!file || typeof file.name !== 'string') return 'Selecione um arquivo válido.';
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  if (!['pdf', 'epub'].includes(ext)) return 'Formato não aceito. Envie PDF ou EPUB.';
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return 'Arquivo vazio ou inválido.';
  if (file.size > MAX_FILE_BYTES) return 'Arquivo maior que 50 MB.';
  return null;
}

export function validatePublication({ publish, title, rightsType, verified, proof, files }) {
  if (!String(title ?? '').trim()) return 'Informe o título do material.';
  if (!publish) return null;
  if (rightsType === 'pendente') return 'Verifique os direitos antes de publicar.';
  if (rightsType === 'somente_catalogo') return null;
  if (!['dominio_publico', 'licenca_aberta', 'autorizado'].includes(rightsType)) {
    return 'Tipo de direito inválido.';
  }
  if (!verified || String(proof ?? '').trim().length < 8) {
    return 'Confira os direitos e informe fonte ou comprovante de no mínimo 8 caracteres.';
  }
  if (!Array.isArray(files) || !files.length) return 'Vincule um arquivo antes de publicar com download.';
  return null;
}

/** Exclusão exclusiva de rascunhos; arquivos devem pertencer à pasta deste material. */
export function validateDraftDeletion({ id, status, files }) {
  if (status !== 'rascunho') return 'Somente materiais com status Rascunho podem ser excluídos.';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) {
    return 'Identificador de material inválido.';
  }
  if (!Array.isArray(files)) return 'Não foi possível verificar os arquivos do material.';
  const prefix = `originais/${id}/`;
  for (const file of files) {
    const path = String(file?.storage_path ?? '');
    if (!path.startsWith(prefix) || path.length <= prefix.length || path.includes('..') || path.includes('\\')) {
      return 'O arquivo está fora da pasta deste material. Exclusão bloqueada.';
    }
  }
  return null;
}

export function importStatus(status) {
  return ({ pronto: 'Pronto para importar', analisando: 'Identificando', enviando: 'Enviando', salvo: 'Rascunho salvo', erro: 'Erro de importação' })[status] || 'Aguardando';
}

/** Confere se os metadados publicados ainda apontam para objetos presentes no bucket. */
export function validateStoredFiles(materialId, fileRows, storageRows) {
  if (!Array.isArray(fileRows) || !fileRows.length) return 'Nenhum arquivo vinculado ao material.';
  const prefix = `originais/${materialId}/`;
  const available = new Set((storageRows || []).map(item => item?.name).filter(Boolean));
  for (const file of fileRows) {
    if (!String(file.storage_path || '').startsWith(prefix)) return 'Caminho de armazenamento inesperado. Revise o arquivo.';
    if (!available.has(file.storage_path.slice(prefix.length))) return `Arquivo não encontrado no armazenamento: ${file.nome_arquivo || 'sem nome'}`;
  }
  return null;
}