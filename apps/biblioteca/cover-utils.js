/** Caminhos de capas isolados por material. Nunca aceitar paths arbitrários. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const COVER_BUCKET='verbo-capas';
export const COVER_MAX_BYTES=2*1024*1024;
export function coverPath(id){
  if(!UUID.test(String(id||'')))throw new Error('Identificador de material inválido para capa.');
  return 'capas/'+id+'/capa.webp';
}
export function isStoredCoverPath(path){
  const match=String(path||'').match(/^capas\/([0-9a-f-]{36})\/capa\.webp$/i);
  return !!(match&&UUID.test(match[1]));
}
export function validateCoverInput(file){
  if(!file)return 'Escolha uma imagem para a capa.';
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))return 'Use JPG, PNG ou WebP.';
  if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>8*1024*1024)return 'A imagem deve ter até 8 MB.';
  return null;
}
