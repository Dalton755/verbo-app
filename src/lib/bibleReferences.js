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
    return valor
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/\s+/g, "");
}

const livroPorAlias = new Map();

for (const livro of LIVROS) {
    for (const alias of livro.aliases) {
        livroPorAlias.set(normalizar(alias), livro);
    }
}

function escaparRegex(valor) {
    return valor
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s*");
}

const aliasesRegex = LIVROS
    .flatMap((livro) => livro.aliases)
    .sort((a, b) => b.length - a.length)
    .map(escaparRegex)
    .join("|");

const referenciaRegex = new RegExp(
    `(^|[^\\p{L}\\p{N}])` +
    `(${aliasesRegex})` +
    `\\.?\\s*` +
    `(\\d{1,3})` +
    `\\s*[:.]\\s*` +
    `(\\d{1,3})` +
    `(?:\\s*[-–—]\\s*(\\d{1,3}))?` +
    `((?:\\s*,\\s*\\d{1,3})*)`,
    "giu",
);

const continuacaoReferenciaRegex =
    /^\s*;\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?((?:\s*,\s*\d{1,3})*)/u;

export function extrairReferenciasBiblicas(texto = "") {
    if (!texto) return [];

    const referencias = [];
    const vistos = new Set();

    function adicionarReferencia({
        livro,
        capitulo,
        versiculoInicio,
        versiculoFim = null,
        versiculosExtras = [],
        textoOriginal,
        indiceInicio,
    }) {
        if (!livro) return;

        if (
            capitulo < 1 ||
            versiculoInicio < 1
        ) {
            return;
        }

        let sufixo = "";

        if (versiculoFim) {
            sufixo = `-${versiculoFim}`;
        } else if (
            versiculosExtras.length > 0
        ) {
            sufixo =
                `,${versiculosExtras.join(",")}`;
        }

        const referencia =
            `${livro.nome} ${capitulo}:${versiculoInicio}${sufixo}`;

        const chave = normalizar(referencia);

        if (vistos.has(chave)) {
            return;
        }

        vistos.add(chave);

        const apiReference =
            `${livro.api} ${capitulo}:${versiculoInicio}${versiculoFim
                ? `-${versiculoFim}`
                : ""
            }`;

        const apiReferences =
            !versiculoFim &&
                versiculosExtras.length > 0
                ? [
                    versiculoInicio,
                    ...versiculosExtras,
                ].map(
                    (versiculo) =>
                        `${livro.api} ${capitulo}:${versiculo}`,
                )
                : [apiReference];

        referencias.push({
            referencia,

            livro: livro.nome,
            livroApi: livro.api,

            capitulo,
            versiculoInicio,
            versiculoFim,
            versiculosExtras,

            apiReference,
            apiReferences,

            textoOriginal,

            indiceInicio,
            indiceFim:
                indiceInicio +
                textoOriginal.length,
        });
    }

    referenciaRegex.lastIndex = 0;

    let match;

    while (
        (match =
            referenciaRegex.exec(texto)) !==
        null
    ) {
        const prefixo = match[1] ?? "";
        const alias = match[2];

        const livro = livroPorAlias.get(
            normalizar(alias),
        );

        if (!livro) {
            continue;
        }

        const capitulo =
            Number(match[3]);

        const versiculoInicio =
            Number(match[4]);

        const versiculoFim =
            match[5]
                ? Number(match[5])
                : null;

        const versiculosExtras = (
            match[6]?.match(/\d{1,3}/g) ?? []
        ).map(Number);

        const indiceInicio =
            match.index +
            prefixo.length;

        const textoOriginal =
            match[0].slice(
                prefixo.length,
            );

        adicionarReferencia({
            livro,
            capitulo,
            versiculoInicio,
            versiculoFim,
            versiculosExtras,
            textoOriginal,
            indiceInicio,
        });

        /*
         * Depois de uma referência explícita,
         * procuramos continuações que omitem
         * o livro.
         *
         * Exemplo:
         *
         * Jo 3.3; 20.22; 15.5
         *
         * vira:
         *
         * João 3:3
         * João 20:22
         * João 15:5
         */

        let cursor =
            match.index +
            match[0].length;

        while (cursor < texto.length) {
            const restante =
                texto.slice(cursor);

            const continuacao =
                restante.match(
                    continuacaoReferenciaRegex,
                );

            if (!continuacao) {
                break;
            }

            const capituloContinuacao =
                Number(continuacao[1]);

            const versiculoContinuacao =
                Number(continuacao[2]);

            const fimContinuacao =
                continuacao[3]
                    ? Number(continuacao[3])
                    : null;

            const extrasContinuacao = (
                continuacao[4]?.match(
                    /\d{1,3}/g,
                ) ?? []
            ).map(Number);

            const prefixoContinuacao =
                continuacao[0].match(
                    /^\s*;\s*/,
                )?.[0] ?? "";

            const textoReferencia =
                continuacao[0].slice(
                    prefixoContinuacao.length,
                );

            const inicioContinuacao =
                cursor +
                prefixoContinuacao.length;

            adicionarReferencia({
                livro,

                capitulo:
                    capituloContinuacao,

                versiculoInicio:
                    versiculoContinuacao,

                versiculoFim:
                    fimContinuacao,

                versiculosExtras:
                    extrasContinuacao,

                textoOriginal:
                    textoReferencia,

                indiceInicio:
                    inicioContinuacao,
            });

            cursor +=
                continuacao[0].length;
        }

        /*
         * Faz o regex principal continuar depois
         * das referências herdadas.
         */
        referenciaRegex.lastIndex =
            Math.max(
                referenciaRegex.lastIndex,
                cursor,
            );
    }

    return referencias;
}

export function extrairContinuacoesBiblicas(
    texto = "",
    contexto = null,
) {
    if (
        !texto ||
        !contexto?.livro ||
        !contexto?.livroApi
    ) {
        return [];
    }

    const referencias = [];

    let cursor = 0;
    let primeira = true;

    while (cursor < texto.length) {
        const restante = texto.slice(cursor);

        const regex = primeira
            ? /^\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?((?:\s*,\s*\d{1,3})*)/u
            : /^\s*;\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?((?:\s*,\s*\d{1,3})*)/u;

        const match = restante.match(regex);

        if (!match) break;

        const capitulo = Number(match[1]);
        const versiculoInicio = Number(match[2]);

        const versiculoFim = match[3]
            ? Number(match[3])
            : null;

        const versiculosExtras = (
            match[4]?.match(/\d{1,3}/g) ?? []
        ).map(Number);

        const primeiroDigito =
            match[0].search(/\d/);

        const indiceInicio =
            cursor +
            Math.max(primeiroDigito, 0);

        const textoOriginal =
            match[0].slice(
                Math.max(primeiroDigito, 0),
            );

        let sufixo = "";

        if (versiculoFim) {
            sufixo = `-${versiculoFim}`;
        } else if (versiculosExtras.length) {
            sufixo =
                `,${versiculosExtras.join(",")}`;
        }

        const referencia =
            `${contexto.livro} ${capitulo}:${versiculoInicio}${sufixo}`;

        const apiReference =
            `${contexto.livroApi} ${capitulo}:${versiculoInicio}${versiculoFim
                ? `-${versiculoFim}`
                : ""
            }`;

        const apiReferences =
            !versiculoFim &&
                versiculosExtras.length
                ? [
                    versiculoInicio,
                    ...versiculosExtras,
                ].map(
                    (versiculo) =>
                        `${contexto.livroApi} ${capitulo}:${versiculo}`,
                )
                : [apiReference];

        referencias.push({
            referencia,

            livro: contexto.livro,
            livroApi: contexto.livroApi,

            capitulo,
            versiculoInicio,
            versiculoFim,
            versiculosExtras,

            apiReference,
            apiReferences,

            textoOriginal,

            indiceInicio,
            indiceFim:
                indiceInicio +
                textoOriginal.length,
        });

        cursor += match[0].length;
        primeira = false;
    }

    return referencias;
}