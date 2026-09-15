const FRASES = [
  [/\bd['’]elle\b/giu, "dele"],
  [/\bd['’]elles\b/giu, "deles"],
  [/\bd['’]ella\b/giu, "dela"],
  [/\bd['’]ellas\b/giu, "delas"],

  [/\bn['’]elle\b/giu, "nele"],
  [/\bn['’]elles\b/giu, "neles"],
  [/\bn['’]ella\b/giu, "nela"],
  [/\bn['’]ellas\b/giu, "nelas"],
];

const PALAVRAS = new Map(
  Object.entries({
    elle: "ele",
    elles: "eles",
    ella: "ela",
    ellas: "elas",

    pae: "pai",
    paes: "pais",

    ha: "há",
    ahi: "aí",
    alli: "ali",

    quizer: "quiser",
    quizesse: "quisesse",
    quizessem: "quisessem",
    quizeram: "quiseram",
    quizera: "quisera",

    poz: "pôs",
    pozeram: "puseram",

    comvosco: "convosco",
    commigo: "comigo",
    comtigo: "contigo",
    comtudo: "contudo",

    aquelle: "aquele",
    aquelles: "aqueles",
    aquella: "aquela",
    aquellas: "aquelas",
    aquillo: "aquilo",

    christo: "cristo",
    christão: "cristão",
    christãos: "cristãos",
    christã: "cristã",
    christãs: "cristãs",

    baptismo: "batismo",
    baptismos: "batismos",
    baptizar: "batizar",
    baptizado: "batizado",
    baptizados: "batizados",
    baptista: "batista",

    phariseu: "fariseu",
    phariseus: "fariseus",

    propheta: "profeta",
    prophetas: "profetas",
    prophetisa: "profetisa",
    prophetizar: "profetizar",
    prophetizou: "profetizou",

    egreja: "igreja",
    egrejas: "igrejas",

    escriptura: "escritura",
    escripturas: "escrituras",
    escripto: "escrito",
    escriptos: "escritos",
    escripta: "escrita",
    escriptas: "escritas",

    offerta: "oferta",
    offertas: "ofertas",
    offerecer: "oferecer",
    offereceu: "ofereceu",
    offerecido: "oferecido",

    occasião: "ocasião",
    occasiões: "ocasiões",

    acceitar: "aceitar",
    acceitou: "aceitou",
    acceita: "aceita",

    permittir: "permitir",
    permittiu: "permitiu",

    cousa: "coisa",
    cousas: "coisas",

    creança: "criança",
    creanças: "crianças",
    porfiae: "porfiai",
    resistaes: "resistais",
    resistae: "resistai",
    offerece: "oferece",
    recto: "reto",
    peccado: "pecado",
    peccados: "pecados",
    appareceu: "apareceu",
    prégando: "pregando",
    preparae: "preparai",
    phariseos: "fariseus",
    
  }),
);

function aplicarCapitalizacao(original, nova) {
  if (
    original === original.toLocaleUpperCase("pt-BR")
  ) {
    return nova.toLocaleUpperCase("pt-BR");
  }

  const primeira = original.charAt(0);

  if (
    primeira ===
    primeira.toLocaleUpperCase("pt-BR")
  ) {
    return (
      nova.charAt(0).toLocaleUpperCase("pt-BR") +
      nova.slice(1)
    );
  }

  return nova;
}

export function modernizarTextoBiblico(texto = "") {
  if (!texto) return "";

  let resultado = texto;

  for (const [regex, substituicao] of FRASES) {
    resultado = resultado.replace(
      regex,
      substituicao,
    );
  }

  resultado = resultado.replace(
    /\p{L}+/gu,
    (palavra) => {
      const chave =
        palavra.toLocaleLowerCase("pt-BR");

      const moderna = PALAVRAS.get(chave);

      if (!moderna) {
        return palavra;
      }

      return aplicarCapitalizacao(
        palavra,
        moderna,
      );
    },
  );

  return resultado;
}