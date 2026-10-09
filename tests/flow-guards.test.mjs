import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_FILE_BYTES,MAX_BATCH_FILES,validateIncomingFile,validatePublication,validateStoredFiles} from '../apps/biblioteca/flow-guards.js';

test('arquivo PDF válido',()=>assert.equal(validateIncomingFile({name:'Estudo.pdf',size:1024}),null));
test('EPUB maiúsculo aceito',()=>assert.equal(validateIncomingFile({name:'LivRO.EPUB',size:3000}),null));
test('formato não permitido',()=>assert.match(validateIncomingFile({name:'arquivo.exe',size:3000}),/Formato/));
test('arquivo vazio recusado',()=>assert.match(validateIncomingFile({name:'Livro.pdf',size:0}),/vazio/));
test('arquivo acima de 50 MB recusado',()=>assert.match(validateIncomingFile({name:'Livro.pdf',size:MAX_FILE_BYTES+1}),/50 MB/));
test('lote limitado a 150',()=>assert.equal(MAX_BATCH_FILES,150));
test('rascunho não exige comprovação',()=>assert.equal(validatePublication({publish:false,title:'Livro',rightsType:'pendente'}),null));
test('título é obrigatório',()=>assert.match(validatePublication({publish:false,title:' ',rightsType:'pendente'}),/título/));
test('publicação com direitos pendentes é bloqueada',()=>assert.match(validatePublication({publish:true,title:'Livro',rightsType:'pendente'}),/direitos/));
test('licença sem comprovante é bloqueada',()=>assert.match(validatePublication({publish:true,title:'Livro',rightsType:'licenca_aberta',verified:true,proof:'ok',files:[1]}),/comprovante/));
test('arquivo ausente impede publicação com download',()=>assert.match(validatePublication({publish:true,title:'Livro',rightsType:'autorizado',verified:true,proof:'https://site',files:[]}),/arquivo/));
test('obra somente catálogo pode ser publicada sem download',()=>assert.equal(validatePublication({publish:true,title:'Livro',rightsType:'somente_catalogo',verified:false,files:[]}),null));
test('publicação com licença confirmada aprovada',()=>assert.equal(validatePublication({publish:true,title:'Livro',rightsType:'licenca_aberta',verified:true,proof:'https://licenca.com',files:[{}]}),null));

test('storage mantém arquivo real',()=>assert.equal(validateStoredFiles('item1',[{storage_path:'originais/item1/teste.pdf',nome_arquivo:'teste.pdf'}],[{name:'teste.pdf'}]),null));
test('storage não aceita caminho de outro livro',()=>assert.match(validateStoredFiles('item1',[{storage_path:'originais/item2/teste.pdf'}],[{name:'teste.pdf'}]),/Caminho/));
test('storage impede publicação de arquivo ausente',()=>assert.match(validateStoredFiles('item1',[{storage_path:'originais/item1/sumido.pdf',nome_arquivo:'sumido.pdf'}],[]),/não encontrado/));