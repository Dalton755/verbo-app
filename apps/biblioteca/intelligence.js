/**
 * VERBO — classificação local transparente e revisável.
 * Treina, em memória, um classificador TF-IDF/cosseno a partir de exemplos
 * curados. NÃO utiliza modelo generativo nem consulta serviços externos.
 * A pontuação é heurística, não é probabilidade calibrada.
 */

export const CATEGORY_CORPUS = Object.freeze({
  'teologia': [
    'teologia sistemática doutrinas cristãs trindade cristologia soteriologia pneumatologia escatologia',
    'a natureza de deus atributos divinos revelação bíblica doutrina da salvação',
    'justificação pela fé predestinação graça aliança teologia bíblica'
  ],
  'estudos-biblicos': [
    'estudos bíblicos gênesis êxodo levítico números deuteronômio pentateuco',
    'análise de versículos do novo testamento cartas do apóstolo paulo',
    'estudo contextual das escrituras personagens e passagens bíblicas'
  ],
  'vida-crista': [
    'vida cristã discipulado santidade crescimento espiritual devoção oração e jejum',
    'práticas cotidianas do cristão comunhão fé esperança amor',
    'devocional relacionamento com deus maturidade espiritual'
  ],
  'historia-da-igreja': [
    'história da igreja cristianismo primitivo pais da igreja patrística',
    'reforma protestante martinho lutero joão calvino',
    'avivamentos e movimentos históricos do protestantismo'
  ],
  'pregacao-homiletica': [
    'homilética pregação sermões expositivos estrutura de sermão',
    'oratória cristã preparo de mensagens exposição bíblica púlpito',
    'comunicação da palavra técnicas de pregação'
  ],
  'ebd': [
    'revista da escola bíblica dominical ebd lições bíblicas professor trimestre adultos',
    'revista de jovens adolescentes crianças lição subsídios professor aluno',
    'comentários da lição primeiro segundo terceiro quarto trimestre da escola dominical'
  ],
  'dicionarios-referencias': [
    'dicionário bíblico significado de palavras léxico grego hebraico aramaico',
    'vocabulário teológico verbetes enciclopédia de termos',
    'referência concordância lexical definição de termos e significados'
  ],
  'comentarios-biblicos': [
    'comentário bíblico exegese hermenêutica análise versículo por versículo',
    'interpretação do evangelho de joão e da epístola aos romanos',
    'comentário expositivo do antigo testamento e novo testamento'
  ],
  'biografias': [
    'biografia vida de missionários pregadores pastores mártires',
    'história pessoal testemunho e trajetória de servos de deus',
    'biografia de líderes cristãos grandes homens e mulheres da fé'
  ],
  'missoes-evangelismo': [
    'missões evangelismo evangelização discipulado missionário',
    'plantação de igrejas campo missionário evangelizar nações',
    'evangelismo pessoal compartilhando a fé e grande comissão'
  ],
  'familia-aconselhamento': [
    'família casamento vida conjugal relacionamento filhos educação dos pais',
    'aconselhamento pastoral terapia familiar crises e reconciliação',
    'relacionamento afetivo educação cristã de crianças e adolescentes'
  ],
  'biblias': [
    'bíblia sagrada tradução revista e atualizada versão bíblica testamentos',
    'antigo e novo testamento texto bíblico integral escrituras sagradas',
    'versão bíblica tradução das escrituras e edição da bíblia'
  ]
});

const TYPE_RULES = [
  ['dicionario', /\b(dicionario|lexico|glossario|vocabulario|encyclopedia|enciclopedia)\b/],
  ['revista_ebd', /\b(revista|ebd|escola biblica dominical|licoes biblicas|trimestre|4t26|3t26|2t26|1t26)\b/],
  ['comentario', /\b(comentario biblico|comentarios biblicos|comentario versiculo|exegese)\b/],
  ['concordancia', /\bconcordancia\b/],
  ['atlas', /\b(atlas biblico|mapas biblicos|geografia biblica)\b/],
  ['apostila', /\bapostila\b/],
  ['biblia', /\b(biblia sagrada|traducao biblica|versao da biblia)\b/]
];

const TOPICS = [
  ['Aliança', /\b(alianca|pacto)\b/],['Graça',/\bgraca\b/],['Salvação',/\b(salvacao|soteriologia|redencao)\b/],
  ['Justificação',/\bjustificacao\b/],['Cristologia',/\b(cristologia|jesus cristo)\b/],
  ['Espírito Santo',/\b(espirito santo|pneumatologia)\b/],['Dons espirituais',/\bdons? espirituais\b/],
  ['Escatologia',/\b(escatologia|arrebatamento|fim dos tempos)\b/],['Oração',/\boracao\b/],
  ['Discipulado',/\bdiscipulado\b/],['Vida cristã',/\bvida crista\b/],['Família',/\b(familia|casamento|vida conjugal)\b/],
  ['História da Igreja',/\b(historia da igreja|reforma protestante)\b/],
  ['Antigo Testamento',/\bantigo testamento\b/],['Novo Testamento',/\bnovo testamento\b/],
  ['Missões',/\b(missoes|missionario|evangelismo)\b/],['EBD',/\b(ebd|escola biblica dominical|licoes biblicas)\b/]
];

const STOP_WORDS = new Set('a o os as de da do dos das um uma uns umas e em para por com sem no na nos nas que como ao aos ou se seu sua seus suas sobre pela pelo este esta esse essa estudo estudos livro livros parte capitulo capitulos introducao crista cristao biblico biblica biblicos biblicas jesus deus igreja'.split(' '));
const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const tokens = (text) => normalize(text).match(/[a-z0-9]{3,}/g)?.filter(w => !STOP_WORDS.has(w)) || [];
function counts(words){ const d = new Map();for(const w of words)d.set(w,(d.get(w)||0)+1);return d; }
const samples = Object.entries(CATEGORY_CORPUS).flatMap(([slug,texts])=>texts.map(text=>({slug,vector:counts(tokens(text))})));
const documentFrequency = counts([...new Set(samples.flatMap(item=>[...item.vector.keys()]))]);
// Frequência documental por material, não por repetição no mesmo material.
for(const word of documentFrequency.keys())documentFrequency.set(word,samples.filter(s=>s.vector.has(word)).length);
const idf = word => Math.log(1+(samples.length+1)/((documentFrequency.get(word)||0)+1));
function vector(input){const tf = counts(tokens(input)); const w = new Map();for(const [key,value] of tf)w.set(key,(1+Math.log(value))*idf(key));return w;}
function similarity(a,b){let dot=0,aa=0,bb=0;for(const v of a.values())aa+=v*v;for(const v of b.values())bb+=v*v;for(const [word,value] of a)dot+=value*(b.get(word)||0);return aa&&bb?dot/Math.sqrt(aa*bb):0;}
const trained = samples.map(x=>({...x,vector:vector([...x.vector.entries()].flatMap(([key,n])=>Array(n).fill(key)).join(' '))}));

export function estimateCatalog(fileName,meta={}) {
  const title = String(meta.titulo||'');
  const sample = String(meta.sample||'').slice(0,12000);
  const coverInput = [fileName,title,meta.temas||''].join(' ');
  const content = [coverInput,coverInput,coverInput,sample.slice(0,4500)].join(' ');
  const modelInput = vector(content);
  const scores = Object.keys(CATEGORY_CORPUS).map(slug=>({slug,score:Math.max(...trained.filter(r=>r.slug===slug).map(r=>similarity(modelInput,r.vector)))}));
  const normTitle = normalize(coverInput);
  // Títulos são sinal bibliográfico mais forte que menções genéricas no prefácio.
  const hints = [
    [/\b(ebd|escola biblica dominical|revista|licoes biblicas|trimestre|[1-4]t\d{2})\b/,'ebd',0.35],
    [/\b(dicionario|lexico|glossario)\b/,'dicionarios-referencias',0.38],
    [/\b(comentario biblico|comentarios biblicos)\b/,'comentarios-biblicos',0.40],
    [/\b(etica pastoral|teologia pastoral|etica ministerial|ministerio pastoral)\b/,'teologia',0.48],
    [/\b(teologia|pneumatologia|cristologia|soteriologia|escatologia)\b/,'teologia',0.30],
    [/\b(homiletica|sermao|sermoes|pregacao expositiva)\b/,'pregacao-homiletica',0.35],
    [/\b(historia da igreja|reforma protestante)\b/,'historia-da-igreja',0.40],
    [/\b(missoes|evangelismo|missionario)\b/,'missoes-evangelismo',0.32],
    [/\b(psicologia pastoral|psicologia crista|ciencia do comportamento|comportamento humano|saude mental|terapia pastoral|aconselhamento psicologico)\b/,'familia-aconselhamento',0.55],
    [/\b(familia|casamento|aconselhamento)\b/,'familia-aconselhamento',0.32],
    [/\b(biblia sagrada|versao biblica|traducao biblica)\b/,'biblias',0.45],
    [/\b(vida crista|discipulado|devocional)\b/,'vida-crista',0.3]
  ];
  for(const [pattern,slug,weight] of hints)if(pattern.test(normTitle))scores.find(r=>r.slug===slug).score+=weight;
  const explicitType=TYPE_RULES.find(([,rx])=>rx.test(normTitle))?.[0] || 'livro';
  // "Bíblias" é um formato de obra, não um assunto. Menções bíblicas em livros de
  // psicologia, teologia ou aconselhamento não justificam classificar o material como Bíblia.
  if(explicitType!=='biblia')scores.find(r=>r.slug==='biblias').score=-1;
  scores.sort((a,b)=>b.score-a.score);
  const best=scores[0];
  const confidence = Math.min(0.91,Math.max(0.32,0.35 + best.score*0.44 + Math.max(0,(best.score-scores[1].score))*0.20));
  const category = explicitType==='biblia'?'biblias':explicitType==='revista_ebd'?'ebd':explicitType==='dicionario'?'dicionarios-referencias': explicitType==='comentario'?'comentarios-biblicos':best.slug;
  return {
    type:explicitType,
    category,
    ranking:scores.slice(0,3).map(r=>({categoria:r.slug,pontuacao:Number(r.score.toFixed(3))})),
    confidence:Number(confidence.toFixed(3)),
    terms:TOPICS.filter(([,rx])=>rx.test(normalize(content))).map(([name])=>name).slice(0,8)
  };
}

export function findISBN(content){
  const text=String(content||''); const pattern=/\bISBN(?:-1[03])?\s*[:：]?\s*((?:97[89][\s-]*)?[0-9X][\dX\s-]{8,19})/ig;
  for(const match of text.matchAll(pattern)){
    const raw=match[1].toUpperCase().replace(/[^0-9X]/g,'');
    if(raw.length===13 && /^\d{13}$/.test(raw)){
      const sum=raw.split('').slice(0,12).reduce((v,d,i)=>v+Number(d)*(i%2?3:1),0);
      if((10-sum%10)%10===Number(raw[12]))return raw;
    }
    if(raw.length===10 && /^\d{9}[\dX]$/.test(raw)){
      const sum=[...raw].reduce((v,d,i)=>v+(d==='X'?10:Number(d))*(10-i),0);
      if(sum%11===0)return raw;
    }
  }
  return null;
}
export function findBiblicalReferences(text){
  const matchPattern=/\b(?:(?:[123]\s*)?(?:G[eê]nesis|[EÊ]xodo|Salmos?|Isa[ií]as|Jo[aã]o|Romanos|Cor[ií]ntios|Ef[eé]sios|Hebreus|Apocalipse)|(?:[1-3]\s*)?(?:Gn|[EÊ]x|Sl|Is|Jo|Rm|Co|Ef|Hb|Ap))\.?\s+\d{1,3}\s*[:.]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/gi;
  return [...new Set((String(text||'').match(matchPattern)||[]).map(x=>x.trim()))].slice(0,25);
}
export function findEditionYear(text){
 const candidate = String(text||'').slice(0,4000).match(/(?:copyright|edi[cç][aã]o|publicad[ao]|©)\s*[:.]?\s*(20\d{2}|19\d{2})/i);
 return candidate ? Number(candidate[1]) : null;
}
export function findEbdPeriod(filename,title){
 const source=normalize(`${filename} ${title||''}`);
 let match=source.match(/(?:\b([1-4])\s*t\s*(20\d{2}|\d{2})\b)/);
 if (match)return {trimestre_ebd:Number(match[1]),ano_ebd:Number(match[2].length===2?'20'+match[2]:match[2])};
 match=source.match(/\b([1-4])(?:º|o)?\s*trimestre\s*(?:de\s*)?(20\d{2})/);
 if(match)return {trimestre_ebd:Number(match[1]),ano_ebd:Number(match[2])};
 return {trimestre_ebd:null,ano_ebd:null};
}