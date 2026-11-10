const LIVROS = [
    { nome: "Gênesis", api: "Genesis", aliases: ["Gênesis", "Genesis", "Gn"] },
    { nome: "Êxodo", api: "Exodus", aliases: ["Êxodo", "Exodo", "Êx", "Ex"] },
    { nome: "Levítico", api: "Leviticus", aliases: ["Levítico", "Levitico", "Lv", "Lev"] },
    { nome: "Números", api: "Numbers", aliases: ["Números", "Numeros", "Nm", "Num"] },
    { nome: "Deuteronômio", api: "Deuteronomy", aliases: ["Deuteronômio", "Deuteronomio", "Dt", "Deut"] },
    { nome: "Josué", api: "Joshua", aliases: ["Josué", "Josue", "Js"] },
    { nome: "Juízes", api: "Judges", aliases: ["Juízes", "Juizes", "Jz"] },
    { nome: "Rute", api: "Ruth", aliases: ["Rute", "Rt"] },

    { nome: "1 Samuel", api: "1 Samuel", aliases: ["1 Samuel", "1Sm", "1 Sm"] },
    { nome: "2 Samuel", api: "2 Samuel", aliases: ["2 Samuel", "2Sm", "2 Sm"] },

    { nome: "1 Reis", api: "1 Kings", aliases: ["1 Reis", "1Rs", "1 Rs"] },
    { nome: "2 Reis", api: "2 Kings", aliases: ["2 Reis", "2Rs", "2 Rs"] },

    { nome: "1 Crônicas", api: "1 Chronicles", aliases: ["1 Crônicas", "1 Cronicas", "1Cr", "1 Cr"] },
    { nome: "2 Crônicas", api: "2 Chronicles", aliases: ["2 Crônicas", "2 Cronicas", "2Cr", "2 Cr"] },

    { nome: "Esdras", api: "Ezra", aliases: ["Esdras", "Ed", "Ezr"] },
    { nome: "Neemias", api: "Nehemiah", aliases: ["Neemias", "Ne"] },
    { nome: "Ester", api: "Esther", aliases: ["Ester", "Et"] },
    { nome: "Jó", api: "Job", aliases: ["Jó", "Job"] },

    { nome: "Salmos", api: "Psalms", aliases: ["Salmos", "Salmo", "Sl", "Ps"] },
    { nome: "Provérbios", api: "Proverbs", aliases: ["Provérbios", "Proverbios", "Pv", "Pr"] },
    { nome: "Eclesiastes", api: "Ecclesiastes", aliases: ["Eclesiastes", "Ec"] },

    {
        nome: "Cantares",
        api: "Song of Solomon",
        aliases: [
            "Cântico dos Cânticos",
            "Cantico dos Canticos",
            "Cantares",
            "Ct",
        ],
    },

    { nome: "Isaías", api: "Isaiah", aliases: ["Isaías", "Isaias", "Is"] },
    { nome: "Jeremias", api: "Jeremiah", aliases: ["Jeremias", "Jr"] },
    { nome: "Lamentações", api: "Lamentations", aliases: ["Lamentações", "Lamentacoes", "Lm"] },
    { nome: "Ezequiel", api: "Ezekiel", aliases: ["Ezequiel", "Ez"] },
    { nome: "Daniel", api: "Daniel", aliases: ["Daniel", "Dn"] },
    { nome: "Oseias", api: "Hosea", aliases: ["Oseias", "Os"] },
    { nome: "Joel", api: "Joel", aliases: ["Joel", "Jl"] },
    { nome: "Amós", api: "Amos", aliases: ["Amós", "Amos", "Am"] },
    { nome: "Obadias", api: "Obadiah", aliases: ["Obadias", "Ob"] },
    { nome: "Jonas", api: "Jonah", aliases: ["Jonas", "Jn"] },
    { nome: "Miqueias", api: "Micah", aliases: ["Miqueias", "Mq"] },
    { nome: "Naum", api: "Nahum", aliases: ["Naum", "Na"] },
    { nome: "Habacuque", api: "Habakkuk", aliases: ["Habacuque", "Hc"] },
    { nome: "Sofonias", api: "Zephaniah", aliases: ["Sofonias", "Sf"] },
    { nome: "Ageu", api: "Haggai", aliases: ["Ageu", "Ag"] },
    { nome: "Zacarias", api: "Zechariah", aliases: ["Zacarias", "Zc"] },
    { nome: "Malaquias", api: "Malachi", aliases: ["Malaquias", "Ml"] },

    { nome: "Mateus", api: "Matthew", aliases: ["Mateus", "Mt"] },
    { nome: "Marcos", api: "Mark", aliases: ["Marcos", "Mc"] },
    { nome: "Lucas", api: "Luke", aliases: ["Lucas", "Lc"] },
    { nome: "João", api: "John", aliases: ["João", "Joao", "Jo"] },
    { nome: "Atos", api: "Acts", aliases: ["Atos", "At"] },
    { nome: "Romanos", api: "Romans", aliases: ["Romanos", "Rm", "Rom"] },

    {
        nome: "1 Coríntios",
        api: "1 Corinthians",
        aliases: ["1 Coríntios", "1 Corintios", "1Co", "1 Co"],
    },
    {
        nome: "2 Coríntios",
        api: "2 Corinthians",
        aliases: ["2 Coríntios", "2 Corintios", "2Co", "2 Co"],
    },

    { nome: "Gálatas", api: "Galatians", aliases: ["Gálatas", "Galatas", "Gl", "Gal"] },
    { nome: "Efésios", api: "Ephesians", aliases: ["Efésios", "Efesios", "Ef"] },

    {
        nome: "Filipenses",
        api: "Philippians",
        aliases: ["Filipenses", "Fp", "Fl"],
    },

    { nome: "Colossenses", api: "Colossians", aliases: ["Colossenses", "Cl", "Col"] },

    {
        nome: "1 Tessalonicenses",
        api: "1 Thessalonians",
        aliases: ["1 Tessalonicenses", "1Ts", "1 Ts"],
    },
    {
        nome: "2 Tessalonicenses",
        api: "2 Thessalonians",
        aliases: ["2 Tessalonicenses", "2Ts", "2 Ts"],
    },

    {
        nome: "1 Timóteo",
        api: "1 Timothy",
        aliases: ["1 Timóteo", "1 Timoteo", "1Tm", "1 Tm"],
    },
    {
        nome: "2 Timóteo",
        api: "2 Timothy",
        aliases: ["2 Timóteo", "2 Timoteo", "2Tm", "2 Tm"],
    },

    { nome: "Tito", api: "Titus", aliases: ["Tito", "Tt"] },
    { nome: "Filemom", api: "Philemon", aliases: ["Filemom", "Fm", "Flm"] },
    { nome: "Hebreus", api: "Hebrews", aliases: ["Hebreus", "Hb"] },
    { nome: "Tiago", api: "James", aliases: ["Tiago", "Tg"] },

    {
        nome: "1 Pedro",
        api: "1 Peter",
        aliases: ["1 Pedro", "1Pe", "1 Pe"],
    },
    {
        nome: "2 Pedro",
        api: "2 Peter",
        aliases: ["2 Pedro", "2Pe", "2 Pe"],
    },

    {
        nome: "1 João",
        api: "1 John",
        aliases: ["1 João", "1 Joao", "1Jo", "1 Jo"],
    },
    {
        nome: "2 João",
        api: "2 John",
        aliases: ["2 João", "2 Joao", "2Jo", "2 Jo"],
    },
    {
        nome: "3 João",
        api: "3 John",
        aliases: ["3 João", "3 Joao", "3Jo", "3 Jo"],
    },

    { nome: "Judas", api: "Jude", aliases: ["Judas", "Jd"] },
    { nome: "Apocalipse", api: "Revelation", aliases: ["Apocalipse", "Ap"] },
];


function normalizar(valor) {
    return valor.normalize("NFD").replace(/\p{Diacritic}/gu, "")
        .toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

const livroPorAlias = new Map();
for (const livro of LIVROS) {
    for (const alias of livro.aliases) {
        livroPorAlias.set(normalizar(alias), livro);
    }
}

function escaparRegex(valor) {
    return valor.replace(/[[\]{}()*+?.\\^$|]/g, "\\$&");
}

// Aceita PDF com espaçamento entre letras, como "C O R Í N T I O S".
const aliasesRegex = LIVROS.flatMap((livro) => livro.aliases)
    .sort((a, b) => b.length - a.length)
    .map((alias) => Array.from(alias.replace(/\s+/g, ""))
        .map(escaparRegex).join("\\s*"))
    .join("|");

// Aceita "1 2 : 4 – 1 1" como "12:4-11".
const numeroFlex = "\\d(?:\\s*\\d){0,2}";
const parteVersiculos = "\\s*[:.]\\s*(" + numeroFlex + ")" +
    "(?:\\s*[-–—]\\s*(" + numeroFlex + "))?" +
    "((?:\\s*,\\s*" + numeroFlex + "(?:\\s*[-–—]\\s*" + numeroFlex + ")?)*)";

const referenciaRegex = new RegExp(
    "(^|[^\\p{L}\\p{N}])(" + aliasesRegex + ")\\.?\\s*" +
    "(" + numeroFlex + ")(?:" + parteVersiculos + ")?", "giu",
);
const continuacaoRegex = new RegExp(
    "^\\s*[;·]\\s*(" + numeroFlex + ")" + parteVersiculos, "u",
);
const continuacaoInicialRegex = new RegExp(
    "^\\s*(" + numeroFlex + ")" + parteVersiculos, "u",
);

function numero(valor) {
    return Number((valor ?? "").replace(/\s+/g, ""));
}

function listaExtras(valor) {
    return (valor ?? "").split(",").slice(1).flatMap((parte) => {
        const [inicio, fim] = parte.trim().split(/\s*[-–—]\s*/).map(numero);
        if (inicio < 1 || (fim && (fim < inicio || fim - inicio > 200))) {
            return [];
        }
        return fim
            ? Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i)
            : [inicio];
    });
}

function criarReferencia({
    livro, capitulo, versiculoInicio = null, versiculoFim = null,
    versiculosExtras = [], textoExtras = "", textoOriginal, indiceInicio,
}) {
    if (!livro || !Number.isInteger(capitulo) || capitulo < 1 ||
        (versiculoInicio !== null && (!Number.isInteger(versiculoInicio) || versiculoInicio < 1)) ||
        (versiculoFim !== null && versiculoFim < versiculoInicio)) {
        return null;
    }

    const capituloCompleto = versiculoInicio === null;
    const sufixo = versiculoFim !== null
        ? "-" + versiculoFim
        : versiculosExtras.length
            ? (textoExtras.replace(/\s+/g, "").replace(/[–—]/g, "-") ||
                "," + versiculosExtras.join(","))
            : "";

    const referencia = livro.nome + " " + capitulo +
        (capituloCompleto ? "" : ":" + versiculoInicio + sufixo);
    const apiReference = livro.api + " " + capitulo +
        (capituloCompleto ? "" : ":" + versiculoInicio +
            (versiculoFim !== null ? "-" + versiculoFim : ""));
    const apiReferences = capituloCompleto
        ? [apiReference]
        : versiculoFim === null && versiculosExtras.length
            ? [versiculoInicio, ...versiculosExtras].map(
                (v) => livro.api + " " + capitulo + ":" + v)
            : [apiReference];

    return {
        referencia, livro: livro.nome, livroApi: livro.api,
        capitulo, versiculoInicio, versiculoFim, versiculosExtras,
        capituloCompleto, apiReference, apiReferences,
        textoOriginal, indiceInicio, indiceFim: indiceInicio + textoOriginal.length,
    };
}

function parseContinuacao(match, livro, texto, inicio) {
    const parteNumerica = match[0].search(/\d/);
    const indiceInicio = inicio + Math.max(0, parteNumerica);
    return criarReferencia({
        livro, capitulo: numero(match[1]), versiculoInicio: numero(match[2]),
        versiculoFim: match[3] ? numero(match[3]) : null,
        versiculosExtras: listaExtras(match[4]), textoExtras: match[4] ?? "",
        textoOriginal: texto.slice(indiceInicio, inicio + match[0].length),
        indiceInicio,
    });
}

export function extrairReferenciasBiblicas(texto = "") {
    if (!texto) return [];
    const referencias = [];
    referenciaRegex.lastIndex = 0;

    let match;
    while ((match = referenciaRegex.exec(texto)) !== null) {
        const livro = livroPorAlias.get(normalizar(match[2]));
        if (!livro) continue;

        const indiceInicio = match.index + (match[1]?.length ?? 0);
        const textoOriginal = match[0].slice(match[1]?.length ?? 0);
        const ref = criarReferencia({
            livro, capitulo: numero(match[3]),
            versiculoInicio: match[4] ? numero(match[4]) : null,
            versiculoFim: match[5] ? numero(match[5]) : null,
            versiculosExtras: listaExtras(match[6]),
            textoExtras: match[6] ?? "", textoOriginal, indiceInicio,
        });
        if (ref) referencias.push(ref);

        // "1 Coríntios 1:11 · 14:26–33" ou "Jo 3:3; 20:22".
        let cursor = referenciaRegex.lastIndex;
        while (cursor < texto.length) {
            const continuacao = texto.slice(cursor).match(continuacaoRegex);
            if (!continuacao) break;
            const herdada = parseContinuacao(continuacao, livro, texto, cursor);
            if (herdada) referencias.push(herdada);
            cursor += continuacao[0].length;
        }
        referenciaRegex.lastIndex = cursor;
    }
    return referencias;
}

export function extrairContinuacoesBiblicas(texto = "", contexto = null) {
    if (!texto || !contexto?.livro || !contexto?.livroApi) return [];

    const livro = { nome: contexto.livro, api: contexto.livroApi };
    const referencias = [];
    let cursor = 0;
    let primeira = true;

    while (cursor < texto.length) {
        const match = texto.slice(cursor).match(
            primeira ? continuacaoInicialRegex : continuacaoRegex,
        );
        if (!match) break;
        const referencia = parseContinuacao(match, livro, texto, cursor);
        if (referencia) referencias.push(referencia);
        cursor += match[0].length;
        primeira = false;
    }
    return referencias;
}
