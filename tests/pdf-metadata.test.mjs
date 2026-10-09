import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {extractCoverBibliography,isUsefulMetadata,textLinesFromPdfItems,pdfReadingNotice,collectPdfTextPages,closePdfReader,titleFromFileName} from '../apps/biblioteca/pdf-metadata.js';

const rows = [
  [{str:'VERBO / BIBLIOTECA CRISTÃ',hasEOL:true}, {str:'Teologia Bíblica',hasEOL:true},{str:'Autor:',transform:[1,0,0,1,100,620]},{str:'Equipe VERBO',transform:[1,0,0,1,135,620],hasEOL:true}],
  [{str:'• Título: Teologia Bíblica - Teste de Importação VERBO',hasEOL:true}, {str:'• Autor: Equipe VERBO',hasEOL:true}]
];
test('reconstrói linhas de páginas a partir de itens e transformações do PDF.js',()=>{
 assert.deepEqual(textLinesFromPdfItems(rows[0]),['VERBO / BIBLIOTECA CRISTÃ','Teologia Bíblica','Autor: Equipe VERBO']);
});
test('detecta título e autor nas primeiras páginas sem PDF metadata',()=>{
 const pages=rows.map(items=>textLinesFromPdfItems(items).join('\n'));
 const result=extractCoverBibliography({pages});
 assert.equal(result.titulo,'Teologia Bíblica - Teste de Importação VERBO');
 assert.equal(result.autor,'Equipe VERBO');
 assert.equal(result.autor_origem,'ficha_no_documento');
});
test('meta autor real prevalece sobre citação do texto',()=>{
 const result=extractCoverBibliography({author:'João L. Silva',pages:['Autor: Pedro F. Costa']});
 assert.equal(result.autor,'João L. Silva');
});
test('não aceita metadado genérico como autor',()=>{
 assert.equal(isUsefulMetadata('Unknown'),false);
 assert.equal(isUsefulMetadata('Autor não identificado'),false);
 assert.equal(extractCoverBibliography({author:'Unknown',pages:['Autor: Editora Alfa']}).autor,'Editora Alfa');
});
test('não inventa autor quando o nome não está disponível',()=>{
 const result=extractCoverBibliography({pages:['Introdução','Capítulo 1','Os dons do Espírito Santo']});
 assert.equal(result.autor,'');
});
test('falha do parser não acusa digitalização',()=>{
 const n=pdfReadingNotice({error:'Setting up fake worker failed'});
 assert.match(n,/falha do leitor/);
 assert.doesNotMatch(n,/possivelmente digitalizado/i);
});
test('páginas realmente sem texto recebem mensagem condicional',()=>{
 const n=pdfReadingNotice({characters:0,pagesRead:3});
 assert.match(n,/Talvez seja digitalizado/);
});
test('extração com texto não produz aviso incorreto',()=>{
 assert.equal(pdfReadingNotice({characters:900,pagesRead:2}), '');
});
test('páginas com transform de linhas em Y diferente',()=>{
 const lines=textLinesFromPdfItems([
   {str:'Autor:',transform:[1,0,0,1,35,800]},
   {str:'Equipe VERBO',transform:[1,0,0,1,98,800]},
   {str:'Direitos pendentes',transform:[1,0,0,1,35,775]}
 ]);
 assert.deepEqual(lines,['Autor: Equipe VERBO','Direitos pendentes']);
});
// Validação da mesma amostra enviada ao admin: PDf com texto selecionável.
const samplePath=path.join(import.meta.dirname,'fixtures/VERBO-Teste-Importacao-Teologia-Biblica.pdf');
test('amostra real PDF contém autor/título e texto selecionável', {skip:!existsSync(samplePath)},()=>{
 const out=execFileSync('pdftotext',['-layout','-f','1','-l','3',samplePath,'-'],{encoding:'utf8'});
 assert.ok(out.length>500);
 const result=extractCoverBibliography({pages:[out]});
 assert.equal(result.autor,'Equipe VERBO');
 assert.match(result.titulo,/Teologia Bíblica/);
 assert.equal(pdfReadingNotice({pagesRead:2,characters:out.length}),'');
});

test('lê seis páginas no máximo, preservando sucessos mesmo com erro em uma',async()=>{
 const calls=[];const doc={numPages:6,async getPage(num){calls.push(num);
   if(num===2)throw new Error('página 2 indisponível');
   return {async getTextContent(){return {items:[{str:'Autor: Equipe VERBO',hasEOL:true}]}},cleanup(){calls.push('cleanup'+num)}};
 }};
 const result=await collectPdfTextPages(doc,6);
 assert.equal(result.pages.length,6);
 assert.deepEqual(result.pageErrors,[2]);
 assert.equal(result.pages[0],'Autor: Equipe VERBO');
 assert.deepEqual(calls,[1,'cleanup1',2,3,'cleanup3',4,'cleanup4',5,'cleanup5',6,'cleanup6']);
});

// Regressão real: o registro Grandes Teólogos retornou `r.destroy is not a function`.
test('título provisório preserva acentos portugueses',()=>{
  assert.equal(titleFromFileName('Grandes Teólogos.pdf'), 'Grandes Teólogos');
  assert.equal(titleFromFileName('A Vida do Espírito Santo.epub'), 'A Vida Do Espírito Santo');
});
test('libera a tarefa PDF.js em vez de chamar destroy no objeto incorreto',async()=>{
  let destroyed=0;
  const task={destroy:async()=>destroyed++};
  const doc={destroy:()=>{throw Error('não chamar destroy da proxy')}};
  assert.equal(await closePdfReader(task,doc),true);
  assert.equal(destroyed,1);
});
test('falha no destroy não invalida metadados já obtidos',async()=>{
  let captured='';
  const task={destroy(){throw Error('r.destroy is not a function')}};
  assert.equal(await closePdfReader(task,{},e=>captured=e.message),false);
  assert.equal(captured,'r.destroy is not a function');
});
test('fallback de fechamento é opcional, nunca executa método inexistente',async()=>{
  assert.equal(await closePdfReader({},{}),true);
  let runs=0;
  assert.equal(await closePdfReader({},{destroy(){runs++}}),true);
  assert.equal(runs,1);
});

// Registro de regressão: PDFCreator publicou Author="Usuário" e title="Etica Pastora - Nemuel Kessler".
test('não atribui o metadado PDFCreator Usuário ao autor',()=>{
  assert.equal(isUsefulMetadata('Usuário'),false);
  assert.equal(isUsefulMetadata('USUARIO'),false);
  assert.equal(isUsefulMetadata('Administrator'),false);
});
test('PDF Ética Pastoral: título e autor são extraídos das primeiras páginas mesmo com metadados incorretos',()=>{
 const pages=[
   'NEMUEL KESSLER', '', 'ÉTICA\nPASTORAL','',
   'NEMUEL KESSLER\nÉTICA\nPASTORAL\nO comportamento\ndo pastor diante de Deus\ne da sociedade',
   'Todos os Direitos Reservados. Copyright © 1989 para a língua portuguesa da Casa Publicadora das Assembleias de Deus.\n241.641 Kessler, Nemuel, 1940-\nKESe Ética pastoral. Rio de Janeiro, CPAD, 1988\n15a Edição 2010'
 ];
 const result=extractCoverBibliography({title:'Etica Pastora - Nemuel Kessler',author:'Usuário',filename:'ÉTICA PASTORAL.pdf',pages});
 assert.equal(result.titulo,'Ética Pastoral');
 assert.equal(result.autor,'Nemuel Kessler');
 assert.equal(result.editora,'CPAD');
 assert.equal(result.titulo_origem,'capa_documento');
 assert.equal(result.autor_origem,'ficha_catalografica');
});
test('autor destacado na capa pode ser encontrado sem ficha catalográfica',()=>{
 const r=extractCoverBibliography({title:'',author:'Usuário',filename:'ÉTICA PASTORAL.pdf',pages:['NEMUEL KESSLER','','ÉTICA\nPASTORAL']});
 assert.equal(r.autor,'Nemuel Kessler');
});
test('o nome de um título em caixa alta não é inventado como autor',()=>{
 const r=extractCoverBibliography({filename:'ÉTICA PASTORAL.pdf',pages:['ÉTICA\nPASTORAL']});
 assert.equal(r.autor,'');
});
// Testa o arquivo realmente fornecido, se montado; não redistribui PDF de terceiros no pacote.
const uploaded='/mnt/data/ÉTICA PASTORAL.pdf';
test('teste real PDF enviado: extrai bibliografia das seis primeiras páginas',{skip:!existsSync(uploaded)},()=>{
 const text=execFileSync('pdftotext',['-layout','-f','1','-l','6',uploaded,'-'],{encoding:'utf8'});
 const pages=text.split('\f');
 const r=extractCoverBibliography({title:'Etica Pastora - Nemuel Kessler',author:'Usuário',filename:'ÉTICA PASTORAL.pdf',pages});
 assert.equal(r.titulo,'Ética Pastoral');
 assert.equal(r.autor,'Nemuel Kessler');
 assert.equal(r.editora,'CPAD');
});