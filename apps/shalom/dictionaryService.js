import { supabase } from "./supabase.js";

const CACHE_PREFIX = "shalom-dicionario:v2:";
const CACHE_POSITIVO_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_NEGATIVO_MS = 6 * 60 * 60 * 1000;

// Definições editoriais usadas apenas quando o Dicionário Aberto não possui
// o verbete. Não atribuir estes textos ao Dicionário Aberto.
const GLOSSARIO_BIBLICO = {
  "expiação": {
    classe: "s.f.",
    definicoes: [
      "Ato de reparar uma falta ou lidar com a culpa por uma transgressão.",
      "No contexto bíblico, designa a ação pela qual o pecado e sua culpa são tratados para restaurar a relação com Deus. No Antigo Testamento, relaciona-se aos sacrifícios; na fé cristã, à obra de Jesus Cristo.",
    ],
  },
};

export function normalizarPalavraSelecionada(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{M}]+/gu, "")
    .replace(/[^\p{L}\p{M}]+$/gu, "");
}

export function ehUmaPalavraSelecionada(valor) {
  const palavra = normalizarPalavraSelecionada(valor);
  return Boolean(palavra && palavra.length <= 80 && !/\s/u.test(palavra) &&
    /^\p{L}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)*$/u.test(palavra));
}

// Consulta a forma selecionada primeiro. Caso não exista no dicionário,
// procura uma forma singular provável, sem mudar o texto que o leitor tocou.
export function formasConsultaveis(valor) {
  const palavra = normalizarPalavraSelecionada(valor).toLocaleLowerCase("pt-BR");
  const formas = [palavra];
  if (palavra.endsWith("ões") && palavra.length > 5) {
    formas.push(palavra.slice(0, -3) + "ão");
  } else if (palavra.endsWith("ores") && palavra.length > 6) {
    formas.push(palavra.slice(0, -4) + "or");
  } else if (palavra.endsWith("eres") && palavra.length > 6) {
    formas.push(palavra.slice(0, -4) + "er");
  } else if (palavra.endsWith("eus") && palavra.length > 5 && palavra !== "mateus") {
    formas.push(palavra.slice(0, -1));
  } else if (/[ao]s$/u.test(palavra) && palavra.length > 4) {
    formas.push(palavra.slice(0, -1));
  }
  return [...new Set(formas)];
}

function cacheKey(palavra) {
  return CACHE_PREFIX + palavra.toLocaleLowerCase("pt-BR");
}

function lerCache(palavra, aceitarExpirado = false) {
  try {
    const raw = localStorage.getItem(cacheKey(palavra));
    if (!raw) return null;
    const { criadoEm, dados } = JSON.parse(raw);
    const ttl = dados?.entradas?.length ? CACHE_POSITIVO_MS : CACHE_NEGATIVO_MS;
    if (!aceitarExpirado && Date.now() - Number(criadoEm || 0) > ttl) return null;
    return dados ?? null;
  } catch { return null; }
}

function salvarCache(palavra, dados) {
  try {
    localStorage.setItem(cacheKey(palavra), JSON.stringify({ criadoEm: Date.now(), dados }));
  } catch { /* A consulta funciona mesmo com cache desativado. */ }
}

function resultadoGlossario(palavra) {
  const verbete = GLOSSARIO_BIBLICO[palavra.toLocaleLowerCase("pt-BR")];
  if (!verbete) return null;
  return {
    palavra,
    encontrado: true,
    entradas: [{ palavra, classe: verbete.classe, definicoes: verbete.definicoes }],
    fonte: "Glossário bíblico do Shalom",
  };
}

export async function buscarSignificadoPalavra(valor) {
  const palavra = normalizarPalavraSelecionada(valor);
  if (!ehUmaPalavraSelecionada(palavra)) throw new Error("SELECAO_NAO_E_PALAVRA");

  const cache = lerCache(palavra);
  if (cache) return cache;

  const formas = formasConsultaveis(palavra);
  let vazio = { palavra, encontrado: false, entradas: [], fonte: "Dicionário Aberto" };

  for (const forma of formas) {
    const { data, error } = await supabase.functions.invoke("dicionario-palavra", {
      body: { palavra: forma },
    });
    if (error) {
      const salvo = lerCache(palavra, true);
      if (salvo?.entradas?.length) return salvo;
      const glossario = resultadoGlossario(formas[0]);
      if (glossario) { salvarCache(palavra, glossario); return glossario; }
      throw error;
    }
    const entradas = Array.isArray(data?.entradas) ? data.entradas : [];
    if (entradas.length) {
      const resultado = {
        ...data,
        palavra,
        encontrado: true,
        entradas,
        fonte: data?.fonte || "Dicionário Aberto",
        ...(forma !== formas[0] ? { formaBase: forma } : {}),
      };
      salvarCache(palavra, resultado);
      return resultado;
    }
    vazio = { ...vazio, fonte: data?.fonte || "Dicionário Aberto" };
  }

  // Não apresentar ausência do verbete geral quando houver explicação
  // editorial relevante. A fonte da explicação é informada na interface.
  const glossario = resultadoGlossario(formas[0]);
  const resultado = glossario ?? vazio;
  salvarCache(palavra, resultado);
  return resultado;
}
