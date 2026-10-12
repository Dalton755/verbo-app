import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extrairDadosLivro } from "../../src/lib/bookMetadata.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// A inferência de autores depende de evidências presentes no próprio PDF.
// Não consultar catálogos externos nem inventar nomes para livros sem metadados.
const normalizar = (valor) => String(valor ?? "").replace(/\s+/g, " ").trim();
const chave = (valor) => normalizar(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function extrairLinhas(items) {
  const linhas = [];
  const itens = (items || []).filter(item => normalizar(item?.str)).map(item => ({
    texto: normalizar(item.str),
    x: Number(item.transform?.[4] || 0),
    y: Number(item.transform?.[5] || 0),
    fonte: Math.max(Math.hypot(Number(item.transform?.[0] || 0), Number(item.transform?.[1] || 0)), 1),
  })).sort((a,b) => Math.abs(b.y-a.y)>3 ? b.y-a.y : a.x-b.x);
  for (const item of itens) {
    let linha = linhas.find(atual => Math.abs(atual.y-item.y) < 3.3);
    if (!linha) { linha={y:item.y,partes:[]}; linhas.push(linha); }
    linha.partes.push(item);
  }
  return linhas.map(linha => {
    const partes=linha.partes.sort((a,b)=>a.x-b.x);
    return { texto:normalizar(partes.map(p=>p.texto).join(" ")), y:linha.y, fonte:Math.max(...partes.map(p=>p.fonte)) };
  }).filter(l=>l.texto).sort((a,b)=>b.y-a.y);
}

function candidatoNome(texto, titulo) {
  const nome=normalizar(texto).replace(/^(?:escrito\s+)?(?:por|by|autor(?:a)?)\s*[:\-]?\s*/i,"").trim();
  if (!nome || chave(nome)===chave(titulo) || nome.length>65 || /[0-9@:/]/.test(nome)) return "";
  if (/\b(?:editora|edição|edicao|copyright|direitos|reservados|publicado|publicacao|capítulo|capitulo|sumário|sumario|isbn|ministerio|ministério|livro|jejum|prefácio|prefacio)\b/i.test(nome)) return "";
  const palavras=nome.split(/\s+/);
  if (palavras.length<2 || palavras.length>5) return "";
  // Nomes próprios: cada palavra relevante tem inicial maiúscula ou o nome todo está em caixa alta.
  const formatoNome=nome===nome.toLocaleUpperCase("pt-BR") || palavras.every((p,i) => /^(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|[a-z]{1,3}$)/u.test(p) || /^(da|de|do|dos|das|e)$/i.test(p) && i>0);
  return formatoNome ? nome : "";
}

function encontrarAutorNasPaginas(paginas,titulo) {
  for (const linhas of paginas) {
    for (let i=0; i<linhas.length; i++) {
      const linha=linhas[i].texto;
      const explicito=linha.match(/^(?:escrito\s+)?(?:autor(?:a)?|author|por|by)\s*[:\-]?\s+(.+)$/i);
      if (explicito) {
        const autor=candidatoNome(explicito[1],titulo);
        if (autor) return autor;
      }
      if (/^(?:por|by|autor(?:a)?|author)\s*:?$/i.test(linha) && linhas[i+1]) {
        const autor=candidatoNome(linhas[i+1].texto,titulo);
        if(autor) return autor;
      }
    }
  }
  const capa=paginas[0]||[];
  const tit=chave(titulo);
  const indiceTitulo=capa.findIndex(l=>tit && (chave(l.texto)===tit || (tit.includes(chave(l.texto)) && chave(l.texto).length>=8)));
  if(indiceTitulo<0) return "";
  // Quando a capa separa título e autor sem rótulo, aceitar apenas um nome
  // próprio nas primeiras linhas imediatamente próximas ao título.
  const tamanhoTitulo=capa[indiceTitulo].fonte;
  for(const l of capa.slice(indiceTitulo+1,indiceTitulo+5)) {
    if(l.fonte>tamanhoTitulo*1.2) continue;
    const autor=candidatoNome(l.texto,titulo);
    if(autor) return autor;
  }
  return "";
}

export async function extrairMetadadosShalom(arquivo) {
  const basicos=await extrairDadosLivro(arquivo);
  if(basicos.autor || !arquivo?.name?.toLowerCase().endsWith(".pdf")) return basicos;
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await arquivo.arrayBuffer())}).promise;
  try {
    const paginas=[];
    // Capa e folha de rosto; páginas além da segunda costumam listar revisores e editoras.
    for(let i=1;i<=Math.min(doc.numPages,2);i++){
      const page=await doc.getPage(i);
      paginas.push(extrairLinhas((await page.getTextContent()).items));
    }
    const autor=encontrarAutorNasPaginas(paginas,basicos.titulo);
    return {...basicos,autor:autor||""};
  }finally{
    await doc.destroy();
  }
}
