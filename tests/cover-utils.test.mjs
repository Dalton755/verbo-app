import test from 'node:test';
import assert from 'node:assert/strict';
import {coverPath,isStoredCoverPath,validateCoverInput,COVER_BUCKET,COVER_MAX_BYTES} from '../apps/biblioteca/cover-utils.js';
const id='11111111-2222-4333-8444-555555555555';
test('gera e valida paths de capa por material',()=>{
 const path=coverPath(id);
 assert.equal(path,'capas/'+id+'/capa.webp');
 assert.ok(isStoredCoverPath(path));
 assert.equal(COVER_BUCKET,'verbo-capas');
 assert.equal(COVER_MAX_BYTES,2097152);
});
test('impede imagem apontando para outro local',()=>{
 for(const p of ['originais/'+id+'/livro.pdf','capas/../capa.webp','capas/xxx/capa.webp','https://site/capa.webp','capas/'+id+'/../../arquivo.webp'])assert.equal(isStoredCoverPath(p),false);
 assert.throws(()=>coverPath('../invalido'),/Identificador/);
});
test('limita tipo e tamanho de upload de capas',()=>{
 assert.equal(validateCoverInput({type:'image/png',size:800000}),null);
 assert.equal(validateCoverInput({type:'image/jpeg',size:800000}),null);
 assert.equal(validateCoverInput({type:'image/webp',size:800000}),null);
 assert.match(validateCoverInput({type:'image/svg+xml',size:100}),/JPG/);
 assert.match(validateCoverInput({type:'image/png',size:9*1024*1024}),/8 MB/);
 assert.match(validateCoverInput(null),/Escolha/);
});
