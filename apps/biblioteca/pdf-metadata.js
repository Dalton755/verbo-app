/**
 * Extração bibliográfica conservadora por camadas:
 * 1. ficha com rótulo; 2. capa/folha de rosto e catalogação; 3. metadados úteis;
 * 4. nome do arquivo (último recurso).
 * Campos genéricos do criador do PDF nunca são tratados como autoria.
 */
const clean = value => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
const boilerplate = /^(?:desconhecido|unknown|autor(?:a)?(?: não identificado)?|sem autor|microsoft|untitled|documento|document|anonymous|an[oô]nimo|user|usu[aá]rio|usuario|administrator|administrador|pdfcreator|acrobat|scanner)$/i;
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g,' ').trim();
const titleWords = /^(?:ética|etica|pastoral|teologia|livro|grande|grandes|sistema|estudo|introdu[cç][aã]o|colet[aâ]nea|o|a|de|das|dos|na|no|em)$/i;

export function isUsefulMetadata(value) {
  const v = clean(value);
  return !!v && v.length <= 180 && !boilerplate.test(v) && !/^(?:microsoft|pdfcreator|libreoffice|adobe|scan|untitled|word)\b/i.test(v);
}

/** Reconstrói linhas a partir das posições e indicações hasEOL do PDF.js. */
export function textLinesFromPdfItems(items = []) {
  const lines=[];
  let current='', previousY=null;
  function flush() {const line=clean(current);if(line)lines.push(line);current='';}
  for(const item of items){
    if(!item||typeof item.str!=='string')continue;
    const y=Array.isArray(item.transform)?Number(item.transform[5]):NaN;
    if(current&&Number.isFinite(y)&&previousY!==null&&Math.abs(y-previousY)>3)flush();
    const part=item.str;
    if(part)current+=(current&&!/\s$/.test(current)&&!/^\s/.test(part)?' ':'')+part;
    if(Number.isFinite(y))previousY=y;
    if(item.hasEOL){flush();previousY=null;}
  }
  flush();return lines;
}

/** Até seis páginas, preservando as demais mesmo se uma página falhar. */
export async function collectPdfTextPages(document,maxPages=6){
  const pages=[],pageErrors=[];
  for(let pageNumber=1;pageNumber<=Math.min(document.numPages,maxPages);pageNumber++){
    let page;
    try{
      page=await document.getPage(pageNumber);
      const content=await page.getTextContent();
      pages.push(textLinesFromPdfItems(content.items).join('\n').slice(0,5500));
    }catch(error){pageErrors.push(pageNumber);pages.push('');}
    finally{page?.cleanup?.();}
  }
  return {pages,pageErrors};
}

function firstLabeledValue(lines,patterns){
  for(const line of lines){
    for(const rx of patterns){
      const match=line.match(rx);
      if(match&&isUsefulMetadata(match[1])){
        const value=clean(match[1]).replace(/[\s,;]+$/,'');
        const first=value.split(/\s+(?=(?:ISBN|editora|publica[cç][aã]o|autor(?:a)?|t[ií]tulo)\s*[:：])/i)[0];
        if(isUsefulMetadata(first))return first;
      }
    }
  }
  return '';
}

function personCase(value){
  return clean(value).replace(/\p{L}+/gu,word=>{
    if(/^(?:d[aeo]s?|e)$/i.test(word))return word.toLocaleLowerCase('pt-BR');
    return word[0].toLocaleUpperCase('pt-BR')+word.slice(1).toLocaleLowerCase('pt-BR');
  });
}

/**
 * Só confia em autor de capa quando há sinal concreto de um nome próprio;
 * evita confundir título, editora, capítulo e rótulos com pessoa.
 */
function coverAuthor(pages,filenameTitle){
  const hints=[];
  const corpus=(pages||[]).slice(0,6).map(page=>String(page||'').split(/\r?\n/).map(clean).filter(Boolean));
  for(const pageLines of corpus){
    for(const line of pageLines.slice(0,12)){
      if(!/^[\p{Lu}\s.'\-]+$/u.test(line)||line.length>75)continue;
      const words=line.trim().split(/\s+/);
      if(words.length<2||words.length>4||words.some(w=>w.length<2))continue;
      if(normalize(line)===normalize(filenameTitle))continue;
      if(words.every(w=>titleWords.test(w)))continue;
      if(/\b(?:EDITORA|PUBLICADORA|ASSEMBLEIAS|DEUS|IGREJA|BIBLIOTECA|TESTAMENTO|CAPITULO|SUMARIO|DIREITOS|RESERVADOS|TRADUCAO|COLECAO)\b/i.test(normalize(line)))continue;
      if(words.filter(w=>titleWords.test(w)).length>=words.length-1)continue;
      hints.push(personCase(line));
    }
  }
  if(!hints.length)return '';
  // Prefere nome repetido em capa e folha de rosto.
  const scored=hints.map((v,i)=>({v,count:hints.filter(x=>normalize(x)===normalize(v)).length,i}));
  scored.sort((a,b)=>b.count-a.count||a.i-b.i);
  return scored[0].v;
}

function catalogAuthor(pages){
  for(const line of (pages||[]).slice(0,8).flatMap(p=>String(p||'').split(/\r?\n/).map(clean))){
    // Exemplo da ficha catalográfica: "241.641 Kessler, Nemuel, 1940-".
    const match=line.match(/^(?:[\d.\s]{3,15})?([\p{Lu}][\p{L}'-]{2,}),\s+([\p{Lu}][\p{L}'-]{2,})(?:\s*,\s*\d{4}[-–]?)?\s*$/u);
    if(match)return personCase(`${match[2]} ${match[1]}`);
  }
  return '';
}

function coverTitle(filename,pages){
  if(!filename)return '';
  const filenameTitle=titleFromFileName(filename);
  const slug=normalize(filenameTitle);
  if(slug.length<6)return '';
  for(const p of (pages||[]).slice(0,6)){
    const lines=String(p||'').split(/\r?\n/).map(clean).filter(Boolean).slice(0,16);
    for(let i=0;i<lines.length;i++){
      for(let n=1;n<=3&&i+n<=lines.length;n++){
        const candidate=lines.slice(i,i+n).join(' ');
        if(normalize(candidate)===slug)return personCase(candidate);
      }
    }
  }
  return '';
}

function titleAndAuthorFromPdfTitle(metadataTitle,filename,pages){
  const raw=clean(metadataTitle);
  if(!raw)return {title:'',author:''};
  const parts=raw.split(/\s+[-–—]\s+/);
  if(parts.length!==2)return {title:raw,author:''};
  const [partTitle,partAuthor]=parts;
  if(!isUsefulMetadata(partAuthor)||partAuthor.split(/\s+/).length<2)return {title:raw,author:''};
  const filenameSlug=normalize(titleFromFileName(filename));
  const prefixSlug=normalize(partTitle);
  // Autor escrito em um título de PDFCreator só conta quando confirmado na capa/ficha.
  const normalizedPages=normalize((pages||[]).slice(0,6).join(' '));
  const validated=normalizedPages.includes(normalize(partAuthor))&&
    (filenameSlug.startsWith(prefixSlug)||prefixSlug.startsWith(filenameSlug.slice(0,Math.max(4,filenameSlug.length-2))));
  return {title:partTitle,author:validated?personCase(partAuthor):''};
}

export function extractCoverBibliography({title='',author='',filename='',sample='',pages=[]}={}){
  const segments=pages.length?pages:[sample];
  const lines=segments.flatMap(txt=>String(txt||'').split(/\r?\n/)).map(clean).filter(Boolean).slice(0,280);
  const labeledTitle=firstLabeledValue(lines,[
    /^(?:[•*\-–]\s*)?t[ií]tulo(?:\s+d[ao]\s+(?:livro|obra))?\s*[:：–-]\s*(.{3,160})$/i,
    /^(?:[•*\-–]\s*)?obra\s*[:：]\s*(.{3,160})$/i
  ]);
  const labeledAuthor=firstLabeledValue(lines,[
    /^(?:[•*\-–]\s*)?autor(?:a|es|as)?\s*[:：–-]\s*(.{3,150})$/i,
    /^(?:[•*\-–]\s*)?(?:escrito|organizado|elaborado)\s+por\s*[:：]?\s*(.{3,150})$/i,
    /^(?:[•*\-–]\s*)?por\s+([\p{L}][\p{L} .'-]{3,100})$/iu
  ]);
  const docCoverTitle=coverTitle(filename,segments);
  const metaTitleParts=titleAndAuthorFromPdfTitle(title,filename,segments);
  const usableTitle=isUsefulMetadata(metaTitleParts.title)?metaTitleParts.title:'';
  const usableAuthor=isUsefulMetadata(author)?clean(author):'';
  const authorByCatalog=catalogAuthor(segments);
  const authorByCover=coverAuthor(segments,filename?titleFromFileName(filename):docCoverTitle);
  const finalAuthor=usableAuthor||labeledAuthor||authorByCatalog||metaTitleParts.author||authorByCover;
  const finalTitle=labeledTitle||docCoverTitle||usableTitle;
  const sourceTitle=labeledTitle?'ficha_no_documento':docCoverTitle?'capa_documento':usableTitle?'metadados_pdf':'nao_encontrado';
  const sourceAuthor=usableAuthor?'metadados_pdf':labeledAuthor?'ficha_no_documento':authorByCatalog?'ficha_catalografica':metaTitleParts.author?'titulo_metadados_confirmado':authorByCover?'capa_documento':'nao_encontrado';
  const bookText=lines.join(' ');
  const editora=/\b(?:CPAD|Casa Publicadora das Assembl[eé]ias de Deus)\b/i.test(bookText)?'CPAD':'';
  return {titulo:finalTitle,autor:finalAuthor||'',editora,titulo_origem:sourceTitle,autor_origem:sourceAuthor};
}

/** Erro de parser jamais significa necessariamente PDF escaneado. */
export function pdfReadingNotice({error='',pageErrors=[],characters=0,pagesRead=0}={}){
  if(error)return 'Não foi possível ler o texto deste PDF no dispositivo. Pode ser uma falha do leitor, não necessariamente um arquivo digitalizado. Confira os dados manualmente.';
  if(pageErrors.length&&characters<60)return 'O leitor não conseguiu processar as páginas do PDF. Isso não confirma que seja um arquivo digitalizado. Confira os dados manualmente.';
  if(characters<60&&pagesRead>0)return 'O leitor abriu o PDF, mas não encontrou texto selecionável nas primeiras páginas. Talvez seja digitalizado; confira o arquivo.';
  if(pageErrors.length)return 'A extração do PDF foi parcial. Confira título, autor e referências.';
  return '';
}

export async function closePdfReader(loadingTask,document,onWarning=()=>{}){
  try{
    if(typeof loadingTask?.destroy==='function')await loadingTask.destroy();
    else if(typeof document?.destroy==='function')await document.destroy();
    return true;
  }catch(error){onWarning(error);return false;}
}

export function titleFromFileName(filename){
  return String(filename??'').replace(/\.(pdf|epub)$/i,'').replace(/^\d{1,4}[ _-]+/,'').replace(/[_.-]+/g,' ').replace(/\s+/g,' ').trim()
    .replace(/(^|\s)(\p{L})/gu,(_,space,letter)=>space+letter.toLocaleUpperCase('pt-BR'));
}