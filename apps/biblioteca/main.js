import './config.js';
import {isStoredCoverPath,COVER_BUCKET} from './cover-utils.js';
const cfg = window.VERBO_CONFIG || {};
const queryParams = new URLSearchParams(location.search);
// "preview=1" era um modo ilustrativo e escondia livros realmente publicados.
// Reservamos "demo=1" apenas para quem pede explicitamente exemplos fictícios.
const isPreview = queryParams.get('demo') === '1' || window.VERBO_PREVIEW === true;
const byId = (id) => document.getElementById(id);
const appState = {
  q: queryParams.get('q') || '',
  type: queryParams.get('tipo') || '',
  topic: queryParams.get('assunto') || '',
  sort: 'recentes',
  page: 1,
  pageSize: 24,
  items: [],
  loading: false,
  hasMore: false,
  controller: null,
  openedItem: null,
  lastFocus: null
};
const TYPE_NAMES = {
  livro: 'Livro', biblia: 'Bíblia', revista_ebd: 'Revista EBD',
  dicionario: 'Dicionário', comentario: 'Comentário bíblico',
  concordancia: 'Concordância', atlas: 'Atlas', apostila: 'Apostila', outro: 'Material'
};
const rightsLabels = {
  dominio_publico: 'Obra em domínio público',
  licenca_aberta: 'Disponibilizada sob licença aberta',
  autorizado: 'Distribuição autorizada',
  somente_catalogo: 'Somente consulta bibliográfica',
  pendente: 'Direitos de distribuição em verificação'
};
const demo = [
  {id:'demo-1',titulo:'Panorama do Antigo Testamento',tipo:'livro',autor:'Exemplo de catálogo',descricao:'Uma introdução panorâmica aos livros do Antigo Testamento, seus contextos e temas centrais.',categorias:['Estudos Bíblicos'],tem_download:false,editora:'Edição de demonstração'},
  {id:'demo-2',titulo:'Introdução à Teologia Bíblica',tipo:'livro',autor:'Exemplo de catálogo',descricao:'Apresentação fictícia de uma obra de teologia bíblica para revisão da interface.',categorias:['Teologia'],tem_download:false},
  {id:'demo-3',titulo:'Dicionário de Termos Bíblicos',tipo:'dicionario',autor:'Exemplo de catálogo',descricao:'Demonstração visual do cadastro de dicionários para consulta de termos e conceitos.',categorias:['Dicionários e Referências'],tem_download:false},
  {id:'demo-4',titulo:'Escola Dominical — Vida Cristã',tipo:'revista_ebd',autor:'Exemplo de catálogo',descricao:'Demonstração de ficha catalográfica para revistas da Escola Bíblica Dominical.',categorias:['Escola Bíblica Dominical'],tem_download:false},
  {id:'demo-5',titulo:'Cartas de Paulo — Estudos',tipo:'comentario',autor:'Exemplo de catálogo',descricao:'Exemplo ilustrativo de um comentário bíblico sobre as epístolas paulinas.',categorias:['Comentários Bíblicos'],tem_download:false},
  {id:'demo-6',titulo:'A História da Igreja',tipo:'livro',autor:'Exemplo de catálogo',descricao:'Exemplo fictício de uma obra sobre história do cristianismo.',categorias:['História da Igreja'],tem_download:false},
  {id:'demo-7',titulo:'Psicologia Pastoral — Exemplo',tipo:'livro',autor:'Exemplo de catálogo',descricao:'Material fictício sobre o cuidado e o comportamento humano.',categorias:['Família e Aconselhamento'],tem_download:false},
  {id:'demo-8',titulo:'Bíblia — Modelo Ilustrativo',tipo:'biblia',autor:'Exemplo de catálogo',descricao:'Modelo visual de cadastro de uma Bíblia, sem conteúdo para download.',categorias:['Estudos Bíblicos'],tem_download:false}
];
const bookColors = [
  ['#557678','#e1edeb'], ['#8f6c56','#f2e8dc'], ['#64617c','#ebe8f3'],
  ['#6b855e','#ecf0e5'], ['#485d74','#e5edf1'], ['#916d66','#f4e9e5']
];
const clean = (value) => String(value == null ? '' : value);
const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = clean(text);
  return e;
};
function stableColor(item) {
  const id = clean(item.id || item.titulo);
  let score = 0;
  for (const c of id) score = (score * 31 + c.charCodeAt(0)) >>> 0;
  return bookColors[score % bookColors.length];
}
function safeImageUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u.href : null; }
  catch { return null; }
}
async function api(path, options = {}) {
  if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('A conexão pública do catálogo ainda não foi configurada.');
  const response = await fetch(cfg.supabaseUrl.replace(/\/$/,'') + path, {
    ...options,
    headers: {
      apikey: cfg.supabasePublishableKey,
      Accept: 'application/json',
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const info = await response.json().catch(() => ({}));
    throw new Error(info.message || 'Não foi possível acessar o acervo (' + response.status + ').');
  }
  return response.json();
}
function syncLocation() {
  const url = new URL(location.href);
  ['q','tipo','assunto','preview'].forEach((k) => url.searchParams.delete(k));
  if (appState.q) url.searchParams.set('q', appState.q);
  if (appState.type) url.searchParams.set('tipo', appState.type);
  if (appState.topic) url.searchParams.set('assunto', appState.topic);
  history.replaceState(null, '', url);
}
function updateFiltersUI() {
  byId('query').value = appState.q;
  byId('catalog-query').value = appState.q;
  byId('topic-select').value = appState.topic;
  document.querySelectorAll('.filter-button').forEach((button) => {
    const selected = button.dataset.type === appState.type;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  byId('clear-all').hidden = !appState.type && !appState.topic && !appState.q;
  const label = appState.type ? (TYPE_NAMES[appState.type] || 'Materiais') : 'Todos os materiais';
  byId('result-title').textContent = appState.q ? 'Resultados para “' + appState.q + '”' : label;
}
function applySort(items) {
  if (appState.sort === 'titulo') return [...items].sort((a,b) => clean(a.titulo).localeCompare(clean(b.titulo), 'pt-BR'));
  return items;
}
function previewResults() {
  const normal = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const t = normal(appState.q).trim();
  let records = demo.filter((m) => (!appState.type || m.tipo === appState.type)
    && (!appState.topic || m.categorias.some((c) => {
      const topics = {
        'teologia':'Teologia','estudos-biblicos':'Estudos Bíblicos',
        'vida-crista':'Vida Cristã','historia-da-igreja':'História da Igreja',
        'ebd':'Escola Bíblica Dominical','comentarios-biblicos':'Comentários Bíblicos',
        'dicionarios-referencias':'Dicionários e Referências',
        'familia-aconselhamento':'Família e Aconselhamento',
        'pregacao-homiletica':'Pregação e Homilética',
        'biografias':'Biografias',
        'missoes-evangelismo':'Missões e Evangelismo'
      };
      return c === topics[appState.topic];
    })) && (!t || normal(m.titulo + ' ' + m.autor + ' ' + m.descricao).includes(t)));
  if (appState.sort === 'titulo') records = applySort(records);
  return records;
}
function loadingSkeletons() {
  const results = byId('results');
  results.replaceChildren(...Array.from({length:6},() => el('div','skeleton-card')));
  byId('result-summary').textContent = 'Buscando no catálogo...';
  byId('pagination').hidden = true;
}
function infoPanel(symbol,title,description,buttonName,action) {
  const p = el('div','state-panel');
  p.append(el('span','state-glyph',symbol),el('h4','',title),el('p','',description));
  if (buttonName) {
    const b = el('button','',buttonName);
    b.type = 'button'; b.addEventListener('click',action); p.append(b);
  }
  byId('results').replaceChildren(p);
  byId('pagination').hidden = true;
}
async function refresh(reset=true) {
  appState.controller?.abort();
  appState.controller = new AbortController();
  if (reset) { appState.page = 1; appState.items = []; loadingSkeletons(); }
  appState.loading = true;
  updateFiltersUI();
  syncLocation();
  const controller = appState.controller;
  try {
    let next;
    if (isPreview) {
      next = appState.page === 1 ? previewResults() : [];
    } else {
      next = await api('/rest/v1/rpc/verbo_buscar', {
        method:'POST', signal:controller.signal,
        body: JSON.stringify({p_termo:appState.q,p_tipo:appState.type || null,
          p_categoria:appState.topic || null,p_limite:appState.pageSize,p_pagina:appState.page})
      });
      if (!Array.isArray(next)) throw new Error('A biblioteca retornou uma resposta inesperada.');
    }
    if (controller.signal.aborted) return;
    appState.items = reset ? next : [...appState.items,...next];
    appState.hasMore = !isPreview && next.length === appState.pageSize;
    renderResults();
  } catch (err) {
    if (err.name === 'AbortError') return;
    appState.hasMore = false;
    if (!reset && appState.items.length) { renderResults(); showToast('Não foi possível carregar mais livros.'); }
    else infoPanel('!', 'Não foi possível carregar a biblioteca', clean(err.message), 'Tentar novamente',()=>refresh());
    byId('result-summary').textContent = 'Falha ao carregar';
  } finally {
    if (appState.controller === controller) appState.loading = false;
  }
}
async function loadProtectedCover(img,path){
  // Capas ficam num bucket privado: o visitante só recebe imagens de livros publicados via RLS.
  if(!isStoredCoverPath(path)||!cfg.supabaseUrl||!cfg.storageAnonJwt)return;
  const url=cfg.supabaseUrl.replace(/\/$/,'')+'/storage/v1/object/authenticated/'+COVER_BUCKET+'/'+path;
  try{
    const response=await fetch(url,{headers:{apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+cfg.storageAnonJwt}});
    if(!response.ok)throw new Error('Acesso à capa negado ('+response.status+').');
    const blob=await response.blob();
    if(!img.isConnected)return;
    const objectUrl=URL.createObjectURL(blob);
    img.onload=()=>{URL.revokeObjectURL(objectUrl);img.onload=null;};
    img.src=objectUrl;
  }catch(error){
    // Sem imagem, o card pode continuar com capa ilustrativa.
    img.dispatchEvent(new Event('error'));
  }
}
function coverArt(item, compact=false) {
  const c = el('div', compact ? 'detail-cover' : 'card-cover-area');
  const [color, bg] = stableColor(item);
  c.style.background = bg;
  if (!compact) c.append(el('span','cover-badge',TYPE_NAMES[item.tipo]||'Material'));
  const imageUrl = safeImageUrl(item.capa_url);
  const privatePath = isStoredCoverPath(item.capa_url) ? item.capa_url : null;
  if (imageUrl || privatePath) {
    const img = el('img','actual-cover');
    img.alt = 'Capa de ' + clean(item.titulo);
    img.loading = 'lazy';
    if(privatePath)loadProtectedCover(img,privatePath);
    else img.src = imageUrl;
    img.onerror = () => img.replaceWith(genericBook());
    c.append(img);
  } else c.append(genericBook());
  return c;
  function genericBook() {
    const book = el('div','card-book');
    book.style.background = color;
    book.append(el('span','book-glyph','✦'));
    book.append(el('span','book-short-title',item.titulo || 'VERBO'));
    book.append(el('span','book-short-sub','BIBLIOTECA VERBO'));
    return book;
  }
}
function card(item) {
  const c = el('article','book-card');
  c.append(coverArt(item));
  const content = el('div','card-content');
  content.append(el('span','card-type',TYPE_NAMES[item.tipo] || 'Material'));
  content.append(el('h4','',item.titulo || 'Sem título'));
  content.append(el('p','card-author',item.autor || 'Autor não informado'));
  const footer = el('div','card-footer');
  footer.append(el('span',item.tem_download ? 'card-availability':'card-availability unavailable',item.tem_download?'● Download gratuito':'● Informações disponíveis'));
  const more = el('button','card-more','Ver detalhes →');
  more.type = 'button';
  more.setAttribute('aria-label','Ver detalhes de ' + clean(item.titulo));
  more.addEventListener('click',() => openDetails(item));
  footer.append(more);
  content.append(footer); c.append(content);
  return c;
}
function renderResults() {
  const items = applySort(appState.items);
  byId('result-summary').textContent = items.length === 1 ? '1 material encontrado' : items.length + ' materiais exibidos';
  if (!items.length) {
    const searching = !!(appState.q || appState.type || appState.topic);
    infoPanel('⌕', searching ? 'Nenhum material encontrado' : 'Nossa coleção está chegando',
      searching ? 'Experimente outro termo, tipo de material ou assunto.' : 'Estamos preparando e verificando os materiais que farão parte da biblioteca. Volte em breve.',
      searching ? 'Ver todos os materiais' : null,
      () => { appState.q='';appState.type='';appState.topic='';refresh(); });
    return;
  }
  byId('results').replaceChildren(...items.map(card));
  byId('pagination').hidden = !appState.hasMore;
}
function openModal(id) {
  appState.lastFocus = document.activeElement;
  const modal = byId(id); modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('[data-close]')?.focus();
}
function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  if (document.querySelectorAll('.modal-backdrop:not([hidden])').length === 0) document.body.style.overflow = '';
  appState.lastFocus?.focus?.();
}
async function openDetails(item) {
  appState.openedItem = item;
  const body = byId('detail-body');
  const header = el('div','detail-header');
  header.append(coverArt(item,true));
  const info = el('div','');
  info.append(el('span','card-type',TYPE_NAMES[item.tipo] || 'Material'));
  const title = el('h2','',item.titulo); title.id = 'detail-title'; info.append(title);
  info.append(el('p','',item.autor || 'Autor não informado'));
  const details = [item.editora, item.ano_publicacao, item.edicao].filter(Boolean).map(clean).join(' · ');
  if (details) info.append(el('p','',details));
  if (item.isbn) info.append(el('p','','ISBN: ' + item.isbn));
  header.append(info);
  body.replaceChildren(header);
  if (item.descricao) body.append(el('div','detail-text',item.descricao));
  if (item.categorias?.length) body.append(el('p','detail-rights','Assuntos: ' + item.categorias.join(' · ')));
  body.append(el('p','detail-rights',rightsLabels[item.direitos_tipo] || 'Informações bibliográficas para consulta.'));
  const dl = el('div','download-list');
  body.append(dl);
  if (isPreview) {
    dl.append(el('span','no-download','Prévia visual: downloads desabilitados.'));
  } else if (!item.tem_download) {
    dl.append(el('span','no-download','Download não disponível para este material.'));
  } else {
    dl.append(el('span','no-download','Verificando os formatos disponíveis...'));
  }
  openModal('detail-modal');
  if (isPreview || !item.tem_download) return;
  try {
    const files = await api('/rest/v1/verbo_arquivos?material_id=eq.' + encodeURIComponent(item.id) + '&select=id,material_id,nome_arquivo,extensao,storage_path,tamanho_bytes&order=created_at.asc');
    if (appState.openedItem !== item || byId('detail-modal').hidden) return;
    dl.replaceChildren();
    if (!files.length) dl.append(el('span','no-download','Nenhum download autorizado para este material.'));
    for (const file of files) {
      const button = el('button','download-button','↓ Baixar ' + file.extensao.toUpperCase());
      button.type = 'button';
      button.addEventListener('click',() => download(file,button));
      dl.append(button);
    }
  } catch(e) {
    if (appState.openedItem !== item) return;
    dl.replaceChildren(el('span','no-download','Não foi possível verificar os downloads. Tente novamente.'));
  }
}
async function download(file, button) {
  if (isPreview) { showToast('Downloads estão desabilitados na prévia visual.'); return; }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparando arquivo...';
  try {
    const path = clean(file.storage_path).split('/').map(encodeURIComponent).join('/');
    if (!cfg.storageAnonJwt) throw new Error('A credencial pública de leitura ainda não foi configurada.');
    const url = cfg.supabaseUrl.replace(/\/$/,'') + '/storage/v1/object/authenticated/' + encodeURIComponent(cfg.storageBucket || 'verbo-acervo') + '/' + path;
    const response = await fetch(url, {headers:{apikey:cfg.supabasePublishableKey, Authorization:'Bearer ' + cfg.storageAnonJwt}});
    if (!response.ok) throw new Error('Arquivo indisponível (' + response.status + ').');
    const blob = await response.blob();
    if (!blob.size) throw new Error('O arquivo retornou vazio.');
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = clean(file.nome_arquivo || 'livro.' + file.extensao).replace(/[\\/]/g,'_');
    document.body.append(anchor);
    anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl),60000);
    closeModal(byId('detail-modal'));
    await showShalom();
  } catch (e) {
    showToast('Não foi possível baixar. ' + clean(e.message));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
async function showShalom() {
  const link = byId('shalom-link');
  const soon = byId('shalom-soon');
  let target = safeImageUrl(cfg.shalomUrl);
  try {
    const offers = await api('/rest/v1/verbo_promocoes?app_destino=eq.shalom&gatilho=eq.apos_download&select=url_destino&order=ordem.asc&limit=1');
    if (offers[0]?.url_destino) target = safeImageUrl(offers[0].url_destino) || target;
  } catch { /* Nenhuma promoção configurada: mostrar futuro app sem link inventado. */ }
  if (target) {link.href=target; link.hidden=false; soon.hidden=true;}
  else { link.hidden=true; soon.hidden=false; }
  openModal('shalom-modal');
}
let toastTimer;
function showToast(message) {
  const box = byId('toast');
  box.textContent = message;box.hidden = false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{box.hidden=true;},5000);
}
function wire() {
  byId('year').textContent = new Date().getFullYear();
  byId('preview-indicator').hidden = !isPreview;
  byId('catalog-search').addEventListener('submit',(ev)=>{
    ev.preventDefault();
    appState.q = byId('catalog-query').value.trim().slice(0,180);
    refresh();
  });
  byId('hero-search').addEventListener('submit',(ev)=>{
    ev.preventDefault();
    appState.q = byId('query').value.trim().slice(0,180);
    refresh();byId('acervo').scrollIntoView({behavior:'smooth'});
  });
  document.querySelectorAll('.quick-tile,.filter-button').forEach((button)=>button.addEventListener('click',()=>{
    appState.type = button.dataset.type || '';
    refresh();byId('acervo').scrollIntoView({behavior:'smooth'});
  }));
  byId('topic-select').addEventListener('change',(e)=>{appState.topic = e.target.value;refresh();});
  byId('sort-select').addEventListener('change',(e)=>{appState.sort=e.target.value;renderResults();});
  byId('clear-all').addEventListener('click',()=>{appState.type='';appState.topic='';appState.q='';refresh();});
  byId('load-more').addEventListener('click',async()=>{
    if(appState.loading)return;
    appState.page += 1;
    byId('load-more').disabled = true;
    await refresh(false);
    byId('load-more').disabled = false;
  });
  document.querySelectorAll('.modal-backdrop').forEach((modal)=>{
    modal.addEventListener('click',(e)=>{if (e.target===modal || e.target.closest('[data-close]'))closeModal(modal);});
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal);
  });
}
wire();
refresh();