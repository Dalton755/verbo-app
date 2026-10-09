import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateCatalog,findISBN,findBiblicalReferences,findEditionYear,findEbdPeriod} from '../apps/biblioteca/intelligence.js';

for(const [filename,category,type] of [
 ['Revista-Adultos-4T26-Professor.pdf','ebd','revista_ebd'],
 ['Teologia Sistemática.pdf','teologia','livro'],
 ['O Deus da Aliança.pdf','teologia','livro'],
 ['Dicionário Bíblico.pdf','dicionarios-referencias','dicionario'],
 ['Homilética para pregadores.pdf','pregacao-homiletica','livro'],
 ['Evangelismo e Missões.pdf','missoes-evangelismo','livro'],
 ['História da Igreja.pdf','historia-da-igreja','livro'],
 ['Comentários Bíblicos - Romanos.pdf','comentarios-biblicos','comentario'],
 ['Bíblia Sagrada - Tradução.pdf','biblias','biblia'],
 ['Aconselhamento para Família.pdf','familia-aconselhamento','livro']
])test('classifica '+filename,()=>{const actual=estimateCatalog(filename);assert.equal(actual.category,category);assert.equal(actual.type,type);assert.ok(actual.confidence>0&&actual.confidence<=1);});
test('ISBN-13 válido',()=> assert.equal(findISBN('ISBN: 978-85-7522-877-7'),'9788575228777'));
test('ISBN inválido não indexado',()=> assert.equal(findISBN('ISBN: 978-85-7522-877-1'),null));
test('revista 4T26',()=>assert.deepEqual(findEbdPeriod('Revista-Adultos-4T26-Professor.pdf'),{trimestre_ebd:4,ano_ebd:2026}));
test('referências bíblicas',()=>assert.deepEqual(findBiblicalReferences('Gn 2:15 e 1 Coríntios 12:4 e Gn 2:15'),['Gn 2:15','1 Coríntios 12:4']));
test('ano copyright',()=>assert.equal(findEditionYear('Copyright ©2026'),2026));

test('Ética Pastoral pertence a Teologia, sem confundir a palavra pastoral com aconselhamento familiar',()=>{
 const r=estimateCatalog('ÉTICA PASTORAL.pdf',{titulo:'Ética Pastoral',sample:'Ética pastoral. Teologia pastoral - Ética. Vocação divina. O pastor e sua vida particular.'});
 assert.equal(r.category,'teologia');
});