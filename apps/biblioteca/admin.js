import './config.js';
import {COVER_BUCKET,COVER_MAX_BYTES,coverPath,isStoredCoverPath,validateCoverInput} from './cover-utils.js';
import {estimateCatalog,findISBN,findBiblicalReferences,findEditionYear,findEbdPeriod} from './intelligence.js';
import { createClient } from '@supabase/supabase-js';
import {validateIncomingFile, validatePublication, validateStoredFiles, validateDraftDeletion, MAX_BATCH_FILES} from './flow-guards.js';
import {extractCoverBibliography, collectPdfTextPages, pdfReadingNotice, closePdfReader, titleFromFileName} from './pdf-metadata.js';

const config = window.VERBO_CONFIG || {};
if (!config.supabaseUrl || !config.supabasePublishableKey) {
  throw new Error('Configuração pública do Supabase não encontrada.');
}
// A chave publicável é adequada para uso no navegador; RLS determina as permissões.
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'nethanel-verbo-biblioteca-auth' }
});
const $ = (id) => document.getElementById(id);
const views = {loading:$('access-loading'),login:$('login-screen'),denied:$('denied-screen'),workspace:$('admin-workspace')};
const state = {user:null,isAdmin:false,categories:[],materials:[],materialsPage:0,materialsHasMore:false,queue:[],editing:null,deleting:null,busy:false,batchRunning:false,batchPaused:false};
const typeLabels = {livro:'Livro',biblia:'Bíblia',dicionario:'Dicionário',revista_ebd:'Revista EBD',comentario:'Comentário',concordancia:'Concordância',atlas:'Atlas',apostila:'Apostila',outro:'Material'};
const coverQueueUrls=new WeakMap();
const bytesText = (size) => size>=1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.ceil(size/1024)} KB`;
function showScreen(screen){Object.entries(views).forEach(([key,node]) => {node.hidden=key!==screen;});}
function note(node,message,isError=true){node.textContent=message;node.hidden=!message;node.style.borderColor=isError?'#edd8ad':'#c7e4cf';}
let toastTimer;
function toast(message){const node=$('admin-toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,5500);}
function asText(text){return String(text??'').trim();}
function titleCase(str){return titleFromFileName(str);}
function fileBase(name){return asText(name).replace(/\.(pdf|epub)$/i,'').replace(/^\d{1,4}[ _-]+/,'').trim();}
function safePath(name){return asText(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(-105)||'material.pdf';}
function xmlNode(doc,local){return Array.from(doc?.getElementsByTagName('*')||[]).find((e)=>e.localName?.toLowerCase()===local.toLowerCase())?.textContent?.trim()||'';}
async function readEpub(file){
  // Faz uma leitura leve de container.xml e OPF usando APIs nativas, com fallback quando deflate-raw não está disponível.
  const buffer=await file.arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer);
  const last=Math.max(0,view.byteLength-66000); let end=-1;
  for(let i=view.byteLength-22;i>=last;i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
  if(end<0)throw new Error('EPUB sem índice ZIP reconhecível.');
  let ptr=view.getUint32(end+16,true),entries=view.getUint16(end+10,true);
  const files=new Map(),decoder=new TextDecoder('utf-8');
  while(entries-- >0 && ptr+46 < view.byteLength && view.getUint32(ptr,true)===0x02014b50){
    const method=view.getUint16(ptr+10,true),size=view.getUint32(ptr+20,true),nameLen=view.getUint16(ptr+28,true),extraLen=view.getUint16(ptr+30,true),commentLen=view.getUint16(ptr+32,true),localOffset=view.getUint32(ptr+42,true);
    const name=decoder.decode(bytes.slice(ptr+46,ptr+46+nameLen));
    files.set(name,{method,size,localOffset});ptr+=46+nameLen+extraLen+commentLen;
  }
  async function getEntry(name){const item=files.get(name);if(!item)return '';
    const off=item.localOffset;if(view.getUint32(off,true)!==0x04034b50) return '';
    const start=off+30+view.getUint16(off+26,true)+view.getUint16(off+28,true);
    const compressed=bytes.slice(start,start+item.size);
    if(item.method===0)return decoder.decode(compressed);
    if(item.method!==8||typeof DecompressionStream==='undefined')return '';
    const output=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return decoder.decode(output);
  }
  const c=await getEntry('META-INF/container.xml');const packageName=c.match(/full-path=["']([^"']+)["']/i)?.[1]||[...files.keys()].find(n=>n.endsWith('.opf'));
  if(!packageName)return {};
  const opf=await getEntry(packageName);const xml=new DOMParser().parseFromString(opf,'application/xml');
  return {titulo:xmlNode(xml,'title'),autor:xmlNode(xml,'creator'),editora:xmlNode(xml,'publisher'),temas:xmlNode(xml,'subject')};
}
function canvasToWebp(canvas,quality=.84){
 return new Promise((resolve,reject)=>{
   canvas.toBlob(blob=>{
     if(!blob||blob.type!=='image/webp')return reject(new Error('Este navegador não conseguiu gerar uma capa WebP.'));
     if(blob.size>COVER_MAX_BYTES)return reject(new Error('A capa gerada ultrapassou 2 MB.'));
     resolve(blob);
   },'image/webp',quality);
 });
}
async function renderPdfCoverPage(pdf){
  const page=await pdf.getPage(1),natural=page.getViewport({scale:1});
  const factor=Math.min(1.6,460/natural.width,660/natural.height);
  const viewport=page.getViewport({scale:factor});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('Canvas indisponível neste aparelho.');
  await page.render({canvasContext:context,canvas,viewport}).promise;
  try{return await canvasToWebp(canvas);}finally{page.cleanup();canvas.width=0;canvas.height=0;}
}
async function convertImageToCover(file){
  const error=validateCoverInput(file);if(error)throw new Error(error);
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,520/bitmap.width,780/bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('Não foi possível processar a imagem.');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    try{return await canvasToWebp(canvas);}finally{canvas.width=0;canvas.height=0;}
  }finally{bitmap.close();}
}
async function pdfCoverFromFile(file){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
  const loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,stopAtErrors:false});
  let pdf;
  try{pdf=await loadingTask.promise;return await renderPdfCoverPage(pdf);}
  finally{await closePdfReader(loadingTask,pdf,error=>console.warn('[VERBO] Falha ao encerrar PDF para capa:',error));}
}
async function readPdf(file){
  // O worker Vite retorna um URL público; manter no mesmo domínio reduz falhas CORS.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({
    data:new Uint8Array(await file.arrayBuffer()),
    useSystemFonts:true,
    stopAtErrors:false
  });
  let doc;
  try{
    doc = await loadingTask.promise;
    const metadata = await doc.getMetadata().catch(()=>({info:{}}));
    const {pages,pageErrors}=await collectPdfTextPages(doc,6);
    const sample=pages.join('\n').slice(0,14000);
    const bib=extractCoverBibliography({
      title:metadata.info?.Title,
      author:metadata.info?.Author,
      filename:file.name,
      pages
    });
    let capa_blob=null;
    try{capa_blob=await renderPdfCoverPage(doc);}
    catch(error){console.warn('[VERBO] Prévia de capa não gerada:',error);}
    return {
      capa_blob,
      titulo:bib.titulo,
      autor:bib.autor,
      editora:bib.editora,
      sample,
      paginas:doc.numPages,
      aviso_leitura:pdfReadingNotice({characters:sample.trim().length,pagesRead:pages.length,pageErrors}),
      extracao_origem:{titulo:bib.titulo_origem,autor:bib.autor_origem}
    };
  }finally{
    // Erros na limpeza NÃO devem apagar título, autor ou texto já extraídos.
    await closePdfReader(loadingTask,doc,error=>{
      console.warn('[VERBO] PDF processado, porém falha ao liberar o leitor:',error);
    });
  }
}
function validBookTitle(metaTitle,filename){const value=asText(metaTitle);
  if(!value||/^(microsoft|word|document|adobe|scan|untitled|sem.t[ií]tulo|pdfcreator|\.\.\.)/i.test(value)||value.length>160)return titleCase(fileBase(filename));
  return value;
}
async function analyzeFile(file){
  const invalid=validateIncomingFile(file);if(invalid)throw new Error(invalid);
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  let info={};let warning='';
  try {info=ext==='pdf'?await readPdf(file):await readEpub(file);}
  catch(err){
    const technical=asText(err?.message||'').replace(/https?:\/\/[^\s]+/gi,'[endereço]').slice(0,115);
    warning=ext==='pdf'
      ? [pdfReadingNotice({error:technical||'erro de leitura'}),technical?'Detalhe técnico: '+technical:''].filter(Boolean).join(' ')
      : 'Não foi possível ler os metadados do EPUB. Confira as informações manualmente.';
    // Em modo de prévia, o motivo concreto fica visível no console do navegador para diagnóstico.
    console.warn('[VERBO] Extração falhou para',file.name,err);
  }
  const text=[fileBase(file.name),info.titulo,info.sample,info.temas].filter(Boolean).join(' ');
  const suggestion=estimateCatalog(file.name,info);
  const title=validBookTitle(info.titulo,file.name),author=asText(info.autor);
  if(info.aviso_leitura)warning=[warning,info.aviso_leitura].filter(Boolean).join(' ');
  const isbn=findISBN(text);
  const period=suggestion.type==='revista_ebd'?findEbdPeriod(file.name,title):{trimestre_ebd:null,ano_ebd:null};
  const references=findBiblicalReferences(info.sample||'');
  const detectedYear=findEditionYear(info.sample||'');
  if(!author) warning=[warning,'Autor não identificado; confira na ficha bibliográfica.'].filter(Boolean).join(' ');
  return {
    titulo:title,autor:author,tipo:suggestion.type,categoria_slug:suggestion.category,
    ranking:suggestion.ranking,temas_texto:[...new Set([...suggestion.terms,asText(info.temas)])].filter(Boolean).join(', '),
    editora:asText(info.editora).slice(0,120),descricao:'',isbn,
    ano_publicacao:detectedYear,trimestre_ebd:period.trimestre_ebd,ano_ebd:period.ano_ebd,
    referencias_biblicas:references,
    paginas:info.paginas||null,capa_blob:info.capa_blob||null,confiança:suggestion.confidence,aviso:warning,
    origem_titulo:info.extracao_origem?.titulo||'nome_arquivo',
    origem_autor:info.extracao_origem?.autor||'nao_encontrado'
  };
}
async function startSession(){
  showScreen('loading');
  const {data:{session},error}=await supabase.auth.getSession();
  if(error){showScreen('login');note($('login-message'),error.message);return;}
  if(!session){showScreen('login');return;}
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user){await supabase.auth.signOut({scope:'local'});showScreen('login');return;}
  state.user=user;
  const {data, error:permissionError}=await supabase.from('verbo_admin_identidade').select('usuario_id,ativo').eq('usuario_id',user.id).maybeSingle();
  if(permissionError){showScreen('denied');$('current-user-id').textContent=user.id;toast('Não foi possível verificar o acesso: '+permissionError.message);return;}
  if(!data?.ativo){state.isAdmin=false;showScreen('denied');$('current-user-id').textContent=user.id;return;}
  state.isAdmin=true;showScreen('workspace');$('logout').hidden=false;
  await Promise.all([loadCategories(),loadMaterials(),loadStats()]);
}
async function loadCategories(){
  const {data,error}=await supabase.from('verbo_admin_categorias').select('id,nome,slug,ativa').order('ordem');
  if(error){toast('Falha ao consultar categorias: '+error.message);return;}
  state.categories=data||[];
  $('edit-category').replaceChildren(new Option('Sem categoria',''),...state.categories.map(c=>new Option(c.nome,c.id)));
}
async function loadMaterials(append=false){
  const page=append?state.materialsPage+1:0;
  const size=50;
  const {data,error}=await supabase.from('verbo_admin_materiais')
    .select('id,titulo,autor,tipo,editora,isbn,ano_publicacao,trimestre_ebd,ano_ebd,referencias_biblicas,descricao,temas_texto,capa_url,status,direitos_tipo,direitos_verificados,direitos_comprovante,publicado_em,created_at')
    .order('created_at',{ascending:false}).range(page*size,page*size+size-1);
  if(error){toast('Falha ao carregar catálogo: '+error.message);return;}
  state.materials=append?[...state.materials,...(data||[])]:data||[];
  state.materialsPage=page;
  state.materialsHasMore=(data?.length||0)===size;
  $('load-more-admin').hidden=!state.materialsHasMore;
  renderMaterials();
}
async function countRows(view){const {count,error}=await supabase.from(view).select('*',{count:'exact',head:true});if(error)throw error;return count??0;}
async function loadStats(){
  try{
    const [all,review,published,files]=await Promise.all([
      countRows('verbo_admin_materiais'),
      supabase.from('verbo_admin_materiais').select('*',{head:true,count:'exact'}).in('status',['rascunho','revisao']).then(({count,error})=>{if(error)throw error;return count??0;}),
      supabase.from('verbo_admin_materiais').select('*',{head:true,count:'exact'}).eq('status','publicado').then(({count,error})=>{if(error)throw error;return count??0;}),
      countRows('verbo_admin_arquivos')]);
    $('stat-total').textContent=all;$('stat-review').textContent=review;$('stat-published').textContent=published;$('stat-files').textContent=files;
  }catch(err){toast('Não foi possível consultar os indicadores.');}
}
function makeNode(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function showTab(name){
  document.querySelectorAll('[data-tab]').forEach(button=>{
    const active=button.dataset.tab===name;button.classList.toggle('tab-active',active);button.setAttribute('aria-selected',String(active));
  });
  $('section-import').hidden=name!=='import';$('section-catalog').hidden=name!=='catalog';
}
function imageBlobInto(img,blob){
 const url=URL.createObjectURL(blob);
 img.onload=()=>{URL.revokeObjectURL(url);img.onload=null;};
 img.onerror=()=>{URL.revokeObjectURL(url);img.hidden=true;img.onload=null;img.onerror=null;};
 img.hidden=false;img.src=url;
}
async function displayAdminCover(img,path,expectedItem){
 if(!isStoredCoverPath(path)){img.hidden=true;return;}
 try{
   const {data,error}=await supabase.storage.from(COVER_BUCKET).download(path);
   if(error||!data)throw(error||new Error('Capa não disponível'));
   if(expectedItem&&state.editing!==expectedItem)return;
   if(!img.isConnected)return;
   imageBlobInto(img,data);
 }catch(err){console.warn('[VERBO] Falha ao carregar miniatura privada:',err);img.hidden=true;}
}
async function persistMaterialCover(material,blob){
 if(!blob||blob.type!=='image/webp'||blob.size>COVER_MAX_BYTES)throw new Error('A capa precisa estar em WebP e ter até 2 MB.');
 const path=coverPath(material.id);
 const {error:storageError}=await supabase.storage.from(COVER_BUCKET).upload(path,blob,{contentType:'image/webp',cacheControl:'60',upsert:true});
 if(storageError)throw storageError;
 const {data,error}=await supabase.from('verbo_admin_materiais').update({capa_url:path,updated_at:new Date().toISOString()})
   .eq('id',material.id).select('id');
 if(error)throw error;
 if(data?.length!==1)throw new Error('Não foi possível registrar o caminho da capa.');
 material.capa_url=path;
 return path;
}
function renderQueue(){
  const area=$('file-queue');area.replaceChildren();
  $('queue-count').textContent=state.queue.length;
  const counts=state.queue.reduce((a,item)=>(a[item.status]=(a[item.status]||0)+1,a),{});
  $('batch-summary').textContent=state.queue.length?`${counts.pronto||0} prontos · ${counts.enviando||0} enviando · ${counts.salvo||0} importados · ${counts.erro||0} erros`:'Adicione materiais para começar.';
  $('clear-queue').hidden=!state.queue.length;
  $('import-all').hidden=state.batchRunning||!state.queue.some(item=>item.status==='pronto');
  $('pause-batch').hidden=!state.batchRunning;
  if(!state.queue.length){area.append(makeNode('div','queue-empty','Nenhum arquivo selecionado. Adicione um PDF ou EPUB para começar.'));return;}
  for(const item of state.queue){
    const card=makeNode('div','queue-card'+(item.status==='erro'?' failed':''));
    const ext=item.file.name.split('.').pop()?.toUpperCase()||'DOC';
    const queueCover=item.meta?.capa_blob;
    if(queueCover){
      const picture=makeNode('img','queue-cover');picture.alt='Capa prévia de '+(item.meta.titulo||item.file.name);
      if(!coverQueueUrls.has(queueCover))coverQueueUrls.set(queueCover,URL.createObjectURL(queueCover));
      picture.src=coverQueueUrls.get(queueCover);card.append(picture);
    } else card.append(makeNode('span','queue-file-icon',ext));
    const details=makeNode('div','queue-meta');details.append(makeNode('strong','',item.meta?.titulo||item.file.name));
    details.append(makeNode('small','',`${bytesText(item.file.size)} · ${item.status==='analisando'?'Identificando metadados...': item.status==='pronto'?'Sugestão pronta para curadoria':item.status==='enviando'?'Enviando ao acervo...':item.status==='salvo'?'Rascunho salvo':item.error||'Pendente'}`));
    if(item.meta) details.append(makeNode('small','queue-sub',`${typeLabels[item.meta.tipo]} · ${item.meta.autor||'Autor não identificado'} · pontuação de classificação ${Math.round(item.meta.confiança*100)}% · ${item.meta.categoria_slug||'sem categoria'}`));
    if(item.meta?.aviso)details.append(makeNode('small','queue-sub',item.meta.aviso));
    card.append(details);
    if(item.status==='pronto'||item.status==='erro'){
      const button=makeNode('button','queue-action',item.status==='erro'?'Tentar novamente':'Importar rascunho');
      button.type='button';button.disabled=state.busy||!!item.materialId;button.title=item.materialId?'Rascunho incompleto: revise pelo catálogo.':'';button.addEventListener('click',()=>importOne(item));card.append(button);
    } else if(item.status==='salvo'){
      const button=makeNode('button','queue-action','Revisar dados');button.type='button';button.addEventListener('click',()=>{
        showTab('catalog');const matched=state.materials.find(m=>m.id===item.materialId);if(matched)openEditor(matched);
      });card.append(button);
    }
    area.append(card);
  }
}
async function enqueueFiles(list){
  const files=Array.from(list||[]);
  if(state.queue.length+files.length>MAX_BATCH_FILES){toast('Limite por lote: 150 arquivos. Importe o lote atual antes de adicionar outros.');return;}
  // Dois leitores simultâneos equilibram velocidade e memória em aparelhos Android.
  async function analyzeQueue(item){
    try{item.meta=await analyzeFile(item.file);item.status='pronto';}
    catch(err){item.status='erro';item.error=err.message;}
    renderQueue();
  }
  const pending=[];
  for(const file of files){
    if(state.queue.some(item=>item.file.name===file.name&&item.file.size===file.size&&item.file.lastModified===file.lastModified)){toast(`“${file.name}” já está na fila.`);continue;}
    const item={file,status:'analisando',meta:null,error:'',materialId:null};state.queue.push(item);renderQueue();
    pending.push(item);
  }
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(2,pending.length)},async()=>{
    while(cursor<pending.length){const item=pending[cursor++];await analyzeQueue(item);}
  }));
}
async function digestFile(file){const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function importOne(item){
  if(state.busy||item.status==='salvo')return;
  if(item.materialId){toast('Há um rascunho incompleto. Revise esse registro antes de tentar importar novamente.');return;}
  state.busy=true;item.status='enviando';item.error='';renderQueue();
  let materialId,storagePath;
  try{
    if(!item.meta)item.meta=await analyzeFile(item.file);
    const sha256=await digestFile(item.file);
    const {data:dupe,error:dupeError}=await supabase.from('verbo_admin_arquivos').select('id').eq('sha256',sha256).limit(1);
    if(dupeError)throw dupeError;
    if(dupe?.length)throw new Error('Esse arquivo já existe no acervo (SHA-256 duplicado).');
    const material={titulo:item.meta.titulo.slice(0,240),autor:item.meta.autor||null,tipo:item.meta.tipo,editora:item.meta.editora||null,temas_texto:item.meta.temas_texto||null,
      isbn:item.meta.isbn||null,ano_publicacao:item.meta.ano_publicacao||null,
      trimestre_ebd:item.meta.trimestre_ebd||null,ano_ebd:item.meta.ano_ebd||null,
      referencias_biblicas:item.meta.referencias_biblicas||[],
      descricao:item.meta.descricao||null,catalogacao_status:'revisar',catalogacao_confianca:item.meta.confiança,
      direitos_tipo:'pendente',direitos_verificados:false,status:'rascunho'};
    const {data:inserted,error:createErr}=await supabase.from('verbo_admin_materiais').insert(material).select('id').single();
    if(createErr)throw createErr;materialId=inserted.id;
    const mime=item.file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'application/epub+zip';
    storagePath=`originais/${materialId}/${sha256.slice(0,16)}-${safePath(item.file.name)}`;
    const {error:storageErr}=await supabase.storage.from(config.storageBucket||'verbo-acervo').upload(storagePath,item.file,{upsert:false,contentType:mime});
    if(storageErr)throw storageErr;
    const {error:fileErr}=await supabase.from('verbo_admin_arquivos').insert({material_id:materialId,storage_path:storagePath,sha256,nome_arquivo:item.file.name,extensao:item.file.name.split('.').pop().toLowerCase(),mime_tipo:mime,tamanho_bytes:item.file.size,download_habilitado:false});
    if(fileErr)throw fileErr;
    const category=state.categories.find(c=>c.slug===item.meta.categoria_slug);
    if(category){const {error:linkErr}=await supabase.from('verbo_admin_vinculos').insert({material_id:materialId,categoria_id:category.id});if(linkErr)throw linkErr;}
    const {error:jobErr}=await supabase.from('verbo_admin_jobs').insert({material_id:materialId,storage_path:storagePath,status:'revisao',etapa:'validacao_humana',modelo:'tfidf-curadoria-local-v2',confianca:item.meta.confiança,sugestao:{titulo:item.meta.titulo,autor:item.meta.autor,tipo:item.meta.tipo,categoria:item.meta.categoria_slug,ranking:item.meta.ranking,temas:item.meta.temas_texto,isbn:item.meta.isbn,ano:item.meta.ano_publicacao,referencias:item.meta.referencias_biblicas,observacao:item.meta.aviso||null}});
    if(jobErr)toast('Arquivo salvo, mas o histórico de classificação não foi registrado.');
    if(item.meta.capa_blob){
      try{await persistMaterialCover({id:materialId},item.meta.capa_blob);}
      catch(err){console.warn('[VERBO] Livro importado sem capa:',err);toast('Rascunho salvo, mas a capa não foi gerada. Você pode adicioná-la na revisão.');}
    }
    item.status='salvo';item.materialId=materialId;toast(`“${item.meta.titulo}” adicionado como rascunho.`);
    await Promise.all([loadMaterials(),loadStats()]);
  }catch(err){item.status='erro';item.error=asText(err.message)||'Falha no upload.';
    if(materialId){
      // Melhor esforço: evita rascunhos órfãos em falhas de upload ou metadados.
      if(storagePath) await supabase.storage.from(config.storageBucket||'verbo-acervo').remove([storagePath]);
      const {error:cleanupError}=await supabase.from('verbo_admin_materiais').delete().eq('id',materialId);
      if(cleanupError){item.error+=' Verifique o rascunho #'+materialId.slice(0,8)+' antes de repetir.';item.materialId=materialId;}
    }
    toast(item.error);
  }finally{state.busy=false;renderQueue();}
}
async function importAll(){
 if(state.batchRunning)return;
 state.batchRunning=true;state.batchPaused=false;renderQueue();
 try{
  for(const item of [...state.queue]){
   if(state.batchPaused)break;
   if(item.status==='pronto') await importOne(item);
  }
 }finally{
  state.batchRunning=false;renderQueue();
  if(state.batchPaused)toast('Importação pausada. Clique em Importar todos para continuar.');
 }
}
function renderMaterials(){
  const region=$('material-list');region.replaceChildren();
  const query=asText($('admin-search').value).toLocaleLowerCase('pt-BR');const status=$('admin-status').value;
  const rows=state.materials.filter(m=>(!status||m.status===status)&&(!query||`${m.titulo} ${m.autor||''} ${m.temas_texto||''}`.toLocaleLowerCase('pt-BR').includes(query)));
  if(!rows.length){region.append(makeNode('div','empty-materials','Nenhum material encontrado. Envie um PDF ou EPUB para começar.'));return;}
  for(const item of rows){
    const row=makeNode('article','material-row');
    const thumbnail=makeNode('span','material-icon');
    if(isStoredCoverPath(item.capa_url)){
      const img=makeNode('img','material-cover-img');img.alt='Capa de '+item.titulo;img.loading='lazy';
      thumbnail.append(img);displayAdminCover(img,item.capa_url);
    } else thumbnail.textContent='▤';
    row.append(thumbnail);
    const body=makeNode('div');body.append(makeNode('strong','',item.titulo));body.append(makeNode('small','',`${item.autor||'Autor não informado'} · ${typeLabels[item.tipo]||'Material'}`));row.append(body);
    const label=makeNode('span',`status-badge ${item.status}`,({rascunho:'Rascunho',revisao:'Em revisão',publicado:'Publicado',oculto:'Oculto'})[item.status]||item.status);
    row.append(label);
    const actions=makeNode('div','material-row-actions');
    const edit=makeNode('button','','Revisar →');edit.type='button';edit.addEventListener('click',()=>openEditor(item));actions.append(edit);
    if(item.status==='rascunho'){
      const remove=makeNode('button','admin-danger-outline','Excluir');remove.type='button';
      remove.setAttribute('aria-label',`Excluir rascunho ${item.titulo}`);
      remove.addEventListener('click',()=>openDeleteConfirm(item));actions.append(remove);
    }
    row.append(actions);
    region.append(row);
  }
}
async function openEditor(item){
  state.editing=item;
  $('edit-name').value=item.titulo||'';$('edit-author').value=item.autor||'';
  $('edit-type').value=item.tipo||'livro';$('edit-topics').value=item.temas_texto||'';
  $('edit-publisher').value=item.editora||'';$('edit-description').value=item.descricao||'';
  $('edit-isbn').value=item.isbn||'';$('edit-year').value=item.ano_publicacao||'';
  $('edit-ebd-quarter').value=item.trimestre_ebd||'';$('edit-ebd-year').value=item.ano_ebd||'';
  $('edit-references').value=(item.referencias_biblicas||[]).join('; ');
  $('edit-rights').value=item.direitos_tipo||'pendente';$('edit-proof').value=item.direitos_comprovante||'';$('edit-verified').checked=!!item.direitos_verificados;
  $('edit-subtitle').textContent=item.status==='publicado'?'Material já publicado. Você pode atualizar as informações ou retornar ao rascunho.':'Confira os dados bibliográficos e verifique o direito de distribuir o arquivo.';
  $('edit-cover-img').hidden=true;
  $('edit-cover-empty').hidden=!!isStoredCoverPath(item.capa_url);
  if(isStoredCoverPath(item.capa_url))displayAdminCover($('edit-cover-img'),item.capa_url,item);
  $('cover-upload').value='';
  $('cover-generate').disabled=true;
  $('edit-files').textContent='Consultando arquivos vinculados...';$('edit-category').value='';$('edit-message').hidden=true;
  $('reanalyze-material').disabled=true;
  $('delete-draft').hidden=item.status!=='rascunho';
  $('edit-backdrop').hidden=false;document.body.style.overflow='hidden';$('edit-name').focus();
  const [files,links]=await Promise.all([
    supabase.from('verbo_admin_arquivos').select('id,nome_arquivo,storage_path,tamanho_bytes,download_habilitado').eq('material_id',item.id),
    supabase.from('verbo_admin_vinculos').select('categoria_id').eq('material_id',item.id)
  ]);
  if(state.editing!==item)return;
  state.editing.files=files.data||[];
  $('reanalyze-material').disabled=!state.editing.files.some(f=>/\.(pdf|epub)$/i.test(f.nome_arquivo));
  $('cover-generate').disabled=!state.editing.files.some(f=>/\.pdf$/i.test(f.nome_arquivo));
  $('edit-category').value=links.data?.[0]?.categoria_id||'';
  $('edit-files').textContent=files.error?'Falha ao consultar arquivos.':!files.data?.length?'Nenhum arquivo vinculado. Este registro é apenas bibliográfico.':files.data.map(f=>`▤ ${f.nome_arquivo} · ${bytesText(f.tamanho_bytes||0)}${f.download_habilitado?' · liberado':''}`).join('\n');
  $('edit-files').style.whiteSpace='pre-line';
}
function closeEditor(){state.editing=null;$('edit-backdrop').hidden=true;document.body.style.overflow='';}
async function updateEditorCover(blob){
  const item=state.editing;if(!item||state.busy)return;
  const controls=[$('cover-generate'),$('cover-choose')];
  state.busy=true;controls.forEach(button=>button.disabled=true);
  note($('edit-message'),'Salvando a capa no armazenamento privado...',false);
  try{
    const path=await persistMaterialCover(item,blob);
    $('edit-cover-empty').hidden=true;imageBlobInto($('edit-cover-img'),blob);
    note($('edit-message'),'Capa salva! Ela aparecerá no catálogo público quando o material for publicado.',false);
    await loadMaterials();
  }catch(error){note($('edit-message'),'Erro ao salvar capa: '+asText(error?.message||error));}
  finally{state.busy=false;controls.forEach(button=>button.disabled=false);}
}
async function generateCoverFromStoredPdf(){
  const item=state.editing;if(!item||state.busy)return;
  const original=item.files?.find(f=>/\.pdf$/i.test(f.nome_arquivo));
  if(!original){note($('edit-message'),'Este material não possui PDF para gerar capa automaticamente.');return;}
  $('cover-generate').disabled=true;
  note($('edit-message'),'Gerando capa da primeira página do PDF...',false);
  try{
    const {data,error}=await supabase.storage.from(config.storageBucket||'verbo-acervo').download(original.storage_path);
    if(error||!data)throw(error||new Error('Não foi possível baixar o PDF privado.'));
    const cover=await pdfCoverFromFile(new File([data],original.nome_arquivo,{type:'application/pdf'}));
    if(state.editing!==item)return;
    await updateEditorCover(cover);
  }catch(error){note($('edit-message'),'Falha ao gerar capa: '+asText(error?.message||error));}
  finally{if(state.editing===item)$('cover-generate').disabled=false;}
}
async function reanalyzeStoredMaterial(){
  const item=state.editing;
  if(!item||state.busy)return;
  const original=item.files?.find(f=>/\.(pdf|epub)$/i.test(f.nome_arquivo));
  if(!original){note($('edit-message'),'Não há PDF ou EPUB vinculado a este material.');return;}
  const button=$('reanalyze-material');
  button.disabled=true;
  note($('edit-message'),'Lendo novamente o arquivo no armazenamento privado...',false);
  try{
    // O usuário autenticado recebe o arquivo segundo as políticas RLS do bucket privado.
    const {data:blob,error}=await supabase.storage.from(config.storageBucket||'verbo-acervo').download(original.storage_path);
    if(error||!blob)throw(error||new Error('Arquivo não encontrado no armazenamento privado'));
    const extension=original.nome_arquivo.split('.').pop().toLowerCase();
    const f=new File([blob],original.nome_arquivo,{type:extension==='pdf'?'application/pdf':'application/epub+zip'});
    const result=await analyzeFile(f);
    if(result.origem_titulo!=='nome_arquivo'&&result.titulo)$('edit-name').value=result.titulo;
    if(result.autor)$('edit-author').value=result.autor;
    if(result.editora&&!$('edit-publisher').value)$('edit-publisher').value=result.editora;
    const revisedCategory=state.categories.find(c=>c.slug===result.categoria_slug);
    if(revisedCategory)$('edit-category').value=revisedCategory.id;
    if(!$('edit-isbn').value&&result.isbn)$('edit-isbn').value=result.isbn;
    if(!$('edit-year').value&&result.ano_publicacao)$('edit-year').value=result.ano_publicacao;
    if(!$('edit-topics').value&&result.temas_texto)$('edit-topics').value=result.temas_texto;
    if(!$('edit-references').value&&result.referencias_biblicas.length)$('edit-references').value=result.referencias_biblicas.join('; ');
    note($('edit-message'),
      `Reanálise concluída. ${result.autor?'Autor identificado: '+result.autor+'. ':'Nenhum autor confirmado. '}${revisedCategory?'Categoria sugerida: '+revisedCategory.nome+'. ':''}${result.aviso?'Atenção: '+result.aviso+' ':''}Confira e toque em “Salvar rascunho” para aplicar.`,false);
  }catch(err){
    console.warn('[VERBO] Falha na reanálise privada:',err);
    note($('edit-message'),'Não foi possível reanalisar este arquivo: '+asText(err?.message||err).slice(0,160));
  }finally{
    if(state.editing===item)button.disabled=false;
  }
}
function openDeleteConfirm(item) {
  if(!state.isAdmin||state.busy||item?.status!=='rascunho')return;
  state.deleting=item;
  $('delete-material-name').textContent=item.titulo||'Sem título';
  note($('delete-message'),'');
  $('delete-backdrop').hidden=false;
  $('delete-cancel').focus();
}
function closeDeleteConfirm(){
  if(state.busy)return;
  state.deleting=null;
  $('delete-backdrop').hidden=true;
  if(!$('edit-backdrop').hidden)$('delete-draft').focus();
}
async function deleteDraft(){
  const selected=state.deleting;
  if(!state.isAdmin||!selected||state.busy)return;
  const button=$('delete-confirm');
  state.busy=true;
  button.disabled=true;$('delete-cancel').disabled=true;
  note($('delete-message'),'Conferindo o rascunho e excluindo arquivos privados...',false);
  try{
    // Confere o estado no banco antes de remover os arquivos.
    const {data:live,error:liveError}=await supabase.from('verbo_admin_materiais')
      .select('id,status,titulo,capa_url').eq('id',selected.id).maybeSingle();
    if(liveError)throw liveError;
    if(!live)throw new Error('O material não existe mais. Atualize a lista.');
    const {data:files,error:filesError}=await supabase.from('verbo_admin_arquivos')
      .select('storage_path').eq('material_id',selected.id);
    if(filesError)throw filesError;
    const invalid=validateDraftDeletion({id:live.id,status:live.status,files});
    if(invalid)throw new Error(invalid);
    if(isStoredCoverPath(live.capa_url)){
      const {error:coverError}=await supabase.storage.from(COVER_BUCKET).remove([live.capa_url]);
      if(coverError)throw new Error('Não foi possível excluir a capa: '+coverError.message);
    }
    // Se a remoção do Storage falhar, o registro permanece para permitir nova tentativa.
    const paths=[...new Set(files.map(f=>f.storage_path))];
    if(paths.length){
      const {error:removeError}=await supabase.storage.from(config.storageBucket||'verbo-acervo').remove(paths);
      if(removeError)throw new Error('Falha ao excluir PDF/EPUB do armazenamento: '+removeError.message);
    }
    // Revalida o status também na exclusão final (protege os materiais publicados).
    const {data:removed,error:deleteError}=await supabase.from('verbo_admin_materiais')
      .delete().eq('id',selected.id).eq('status','rascunho').select('id');
    if(deleteError)throw deleteError;
    if(removed?.length!==1)throw new Error('O registro não foi excluído. Atualize a lista e confira o status.');
    state.queue=state.queue.filter(entry=>entry.materialId!==selected.id);
    renderQueue();
    if(state.editing?.id===selected.id)closeEditor();
    state.deleting=null;$('delete-backdrop').hidden=true;
    toast('Rascunho e arquivos excluídos permanentemente.');
    await Promise.all([loadMaterials(),loadStats()]);
  }catch(err){
    note($('delete-message'),'Exclusão não concluída: '+asText(err?.message||err));
  }finally{
    state.busy=false;button.disabled=false;$('delete-cancel').disabled=false;
  }
}

async function saveEdit(publish=false){
  const item=state.editing;if(!item||state.busy)return;
  const type=$('edit-rights').value,verified=$('edit-verified').checked,proof=asText($('edit-proof').value);
  const invalid=validatePublication({publish,title:$('edit-name').value,rightsType:type,verified,proof,files:item.files});
  if(invalid){note($('edit-message'),invalid);return;}
  state.busy=true;$('save-draft').disabled=true;$('publish-material').disabled=true;note($('edit-message'),'Salvando alterações...',false);
  try{
    if(publish && type!=='somente_catalogo'){
      const folder=`originais/${item.id}`;
      const {data:present,error:storageError}=await supabase.storage.from(config.storageBucket||'verbo-acervo').list(folder,{limit:100});
      if(storageError)throw new Error('Não foi possível conferir arquivos no Storage: '+storageError.message);
      const missing=validateStoredFiles(item.id,item.files,present);
      if(missing)throw new Error(missing);
    }
    const details={titulo:asText($('edit-name').value),autor:asText($('edit-author').value)||null,
      tipo:$('edit-type').value,editora:asText($('edit-publisher').value)||null,
      descricao:asText($('edit-description').value)||null,temas_texto:asText($('edit-topics').value)||null,
      isbn:asText($('edit-isbn').value)||null,ano_publicacao:Number($('edit-year').value)||null,
      trimestre_ebd:Number($('edit-ebd-quarter').value)||null,ano_ebd:Number($('edit-ebd-year').value)||null,
      referencias_biblicas:asText($('edit-references').value).split(';').map(s=>s.trim()).filter(Boolean),
      direitos_tipo:type,direitos_comprovante:proof||null,direitos_verificados:verified && type!=='pendente' && type!=='somente_catalogo',
      direitos_verificados_em:verified&&type!=='pendente'&&type!=='somente_catalogo'?new Date().toISOString():null,
      status:publish?'publicado':'rascunho',publicado_em:publish?new Date().toISOString():null,updated_at:new Date().toISOString(),
      catalogacao_status:'concluida'};
    if(!details.titulo)throw new Error('Informe o título do material.');
    const {data:updated,error:updateError}=await supabase.from('verbo_admin_materiais').update(details).eq('id',item.id).select('id');
    if(updateError)throw updateError;
    if(updated?.length!==1)throw new Error('Atualização sem confirmação. Recarregue a lista antes de tentar novamente.');
    const enable=publish&&type!=='somente_catalogo';
    const {error:fileError}=await supabase.from('verbo_admin_arquivos').update({download_habilitado:enable}).eq('material_id',item.id);
    if(fileError)throw fileError;
    const {data:links,error:linkError}=await supabase.from('verbo_admin_vinculos').select('categoria_id').eq('material_id',item.id);
    if(linkError)throw linkError;
    const chosen=$('edit-category').value;
    if(links?.length){const {error:delError}=await supabase.from('verbo_admin_vinculos').delete().eq('material_id',item.id);if(delError)throw delError;}
    if(chosen){const {error:categoryError}=await supabase.from('verbo_admin_vinculos').insert({material_id:item.id,categoria_id:chosen});if(categoryError)throw categoryError;}
    toast(publish?'Livro publicado. Download autorizado conforme revisão.':'Rascunho salvo.');
    closeEditor();await Promise.all([loadMaterials(),loadStats()]);
  }catch(err){note($('edit-message'),`Não foi possível salvar: ${asText(err.message)}`);}
  finally{state.busy=false;$('save-draft').disabled=false;$('publish-material').disabled=false;}
}

async function testConnections() {
  const button=$('run-diagnostics'), box=$('diagnostics-result');
  if(!state.isAdmin){toast('Entre com uma conta administradora antes de testar.');return;}
  button.disabled=true;
  box.hidden=false;
  box.replaceChildren(makeNode('strong','','Verificando conexão com Supabase...'));
  const checks=[
    ['Autenticação Google/conta',async()=>{const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw(error||new Error('Sessão ausente'));return data.user.email||'autenticado';}],
    ['Permissão de administrador',async()=>{const {data,error}=await supabase.from('verbo_admin_identidade').select('ativo').eq('usuario_id',state.user.id).maybeSingle();if(error||!data?.ativo)throw(error||new Error('Permissão não encontrada'));return 'autorizado';}],
    ['Acesso ao catálogo',async()=>{const {error}=await supabase.from('verbo_admin_materiais').select('id').limit(1);if(error)throw error;return 'disponível';}],
    ['Busca pública',async()=>{const {error}=await supabase.rpc('verbo_buscar',{p_termo:'',p_limite:1});if(error)throw error;return 'operacional';}],
    ['Storage privado',async()=>{const {error}=await supabase.storage.from(config.storageBucket||'verbo-acervo').list('originais',{limit:1});if(error)throw error;return 'conectado';}]
  ];
  let passed=0;
  for(const [name,fn] of checks) {
    const row=makeNode('div','diagnostics-row');const title=makeNode('b','',name);const result=makeNode('span','','Testando...');row.append(title,result);box.append(row);
    try {const value=await fn();result.textContent='✓ '+value;result.className='diagnostics-success';passed++;}
    catch(e){result.textContent='✕ '+asText(e.message||e).slice(0,180);result.className='diagnostics-failed';}
  }
  box.querySelector('strong').textContent=`Diagnóstico: ${passed}/${checks.length} verificações aprovadas`;
  button.disabled=false;
}

$('run-diagnostics').addEventListener('click',testConnections);
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('login-submit');button.disabled=true;note($('login-message'),'Conectando...',false);
  const {error}=await supabase.auth.signInWithPassword({email:$('auth-email').value.trim(),password:$('auth-password').value});
  button.disabled=false;
  if(error){note($('login-message'),error.message);return;}
  await startSession();
});
$('google-login').addEventListener('click',async()=>{
  const redirectTo=new URL('admin.html',location.href).href;
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
  if(error)note($('login-message'),error.message);
});
$('logout').addEventListener('click',async()=>{
  await supabase.auth.signOut({scope:'local'});state.isAdmin=false;$('logout').hidden=true;showScreen('login');
});
$('copy-user-id').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('current-user-id').textContent);toast('Identificador copiado.');}catch{toast('Selecione o identificador para copiar.');}
});
$('focus-import').addEventListener('click',()=>{showTab('import');$('dropzone').scrollIntoView({behavior:'smooth',block:'center'});});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('dropzone').addEventListener('click',()=>$('file-input').click());
$('dropzone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file-input').click();}});
$('file-input').addEventListener('change',e=>{enqueueFiles(e.target.files);e.target.value='';});
['dragenter','dragover'].forEach(type=>$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.add('is-dragging');}));
['dragleave','drop'].forEach(type=>$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.remove('is-dragging');}));
$('dropzone').addEventListener('drop',e=>enqueueFiles(e.dataTransfer?.files));
$('clear-queue').addEventListener('click',()=>{if(state.busy)return;state.queue=[];renderQueue();});
$('import-all').addEventListener('click',importAll);
$('pause-batch').addEventListener('click',()=>{state.batchPaused=true;toast('O lote vai pausar depois do arquivo em andamento.');});
$('load-more-admin').addEventListener('click',async()=>{const b=$('load-more-admin');b.disabled=true;await loadMaterials(true);b.disabled=false;});
$('admin-search').addEventListener('input',renderMaterials);$('admin-status').addEventListener('change',renderMaterials);
$('close-edit').addEventListener('click',closeEditor);$('edit-backdrop').addEventListener('click',e=>{if(e.target===$('edit-backdrop'))closeEditor();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('edit-backdrop').hidden)closeEditor();});
$('reanalyze-material').addEventListener('click',reanalyzeStoredMaterial);
$('cover-generate').addEventListener('click',generateCoverFromStoredPdf);
$('cover-choose').addEventListener('click',()=>$('cover-upload').click());
$('cover-upload').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file||!state.editing)return;
 try{const blob=await convertImageToCover(file);await updateEditorCover(blob);}
 catch(error){note($('edit-message'),'Não foi possível processar a imagem: '+asText(error?.message||error));}
});
$('delete-draft').addEventListener('click',()=>openDeleteConfirm(state.editing));
$('delete-confirm').addEventListener('click',deleteDraft);
$('delete-cancel').addEventListener('click',closeDeleteConfirm);
$('delete-backdrop').addEventListener('click',event=>{if(event.target===$('delete-backdrop'))closeDeleteConfirm();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('delete-backdrop').hidden){event.stopImmediatePropagation();closeDeleteConfirm();}},true);
$('save-draft').addEventListener('click',()=>saveEdit(false));$('publish-material').addEventListener('click',()=>saveEdit(true));
renderQueue();startSession();