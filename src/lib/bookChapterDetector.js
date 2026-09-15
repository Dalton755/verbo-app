/*
 * =========================================
 * DETECTOR AUTOMÁTICO DE CAPÍTULOS
 * =========================================
 *
 * O PDF já fornece:
 *
 * pagina.numero
 * pagina.blocos[]
 * bloco.tipo
 * bloco.texto
 * bloco.tamanhoFonte
 *
 * Aqui tentamos identificar a estrutura
 * sem depender somente do tamanho da fonte.
 */


function normalizarEstrutura(
    valor,
) {
    return String(
        valor ?? "",
    )
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .replace(
            /[“”"'‘’]/g,
            "",
        )
        .replace(
            /\s+/g,
            " ",
        )
        .trim()
        .toLocaleUpperCase(
            "pt-BR",
        );
}


function compactarEstrutura(
    valor,
) {
    return normalizarEstrutura(
        valor,
    )
        .replace(
            /[^A-Z0-9]/g,
            "",
        );
}


/*
 * Números por extenso mais comuns
 * em títulos de capítulos.
 *
 * compactarEstrutura transforma:
 *
 * "D OIS" -> "DOIS"
 * "T RÊS" -> "TRES"
 * "O ITO" -> "OITO"
 */
const NUMEROS_EXTENSO = {
    UM: 1,
    DOIS: 2,
    TRES: 3,
    QUATRO: 4,
    CINCO: 5,
    SEIS: 6,
    SETE: 7,
    OITO: 8,
    NOVE: 9,
    DEZ: 10,
    ONZE: 11,
    DOZE: 12,
    TREZE: 13,
    QUATORZE: 14,
    CATORZE: 14,
    QUINZE: 15,
    DEZESSEIS: 16,
    DEZASSEIS: 16,
    DEZESSETE: 17,
    DEZOITO: 18,
    DEZENOVE: 19,
    VINTE: 20,
    VINTEUM: 21,
    VINTEDOIS: 22,
    VINTETRES: 23,
    VINTEQUATRO: 24,
    VINTECINCO: 25,
    VINTESEIS: 26,
    VINTESETE: 27,
    VINTEOITO: 28,
    VINTENOVE: 29,
    TRINTA: 30,
};


function romanoParaNumero(
    valor,
) {
    const texto =
        String(
            valor ?? "",
        )
            .trim()
            .toUpperCase();

    if (
        !texto ||
        !/^[IVXLCDM]+$/.test(
            texto,
        )
    ) {
        return null;
    }

    const valores = {
        I: 1,
        V: 5,
        X: 10,
        L: 50,
        C: 100,
        D: 500,
        M: 1000,
    };

    let total = 0;
    let anterior = 0;

    for (
        let indice =
            texto.length - 1;
        indice >= 0;
        indice -= 1
    ) {
        const atual =
            valores[
                texto[indice]
            ];

        if (atual < anterior) {
            total -= atual;
        } else {
            total += atual;
            anterior = atual;
        }
    }

    if (
        total <= 0 ||
        total > 200
    ) {
        return null;
    }

    return total;
}


function extrairNumeroSimples(
    valor,
) {
    const normalizado =
        normalizarEstrutura(
            valor,
        );

    const compacto =
        compactarEstrutura(
            valor,
        );

    /*
     * 1
     * 12
     * 12.
     */
    const arabico =
        normalizado.match(
            /^(\d{1,3})[.)-]?$/,
        );

    if (arabico) {
        return Number(
            arabico[1],
        );
    }

    /*
     * UM
     * D OIS
     * T RÊS
     */
    if (
        Object.prototype
            .hasOwnProperty.call(
                NUMEROS_EXTENSO,
                compacto,
            )
    ) {
        return NUMEROS_EXTENSO[
            compacto
        ];
    }

    /*
     * I
     * II
     * XII
     */
    return romanoParaNumero(
        compacto,
    );
}


function extrairCapituloExplicito(
    valor,
) {
    const texto =
        normalizarEstrutura(
            valor,
        );

    const encontrado =
        texto.match(
            /^(?:CAPITULO|CAP\.?)\s+([A-Z0-9]+)(?:\s*[:.\-–—]\s*|\s+)?(.*)$/,
        );

    if (!encontrado) {
        return null;
    }

    const numeroTexto =
        encontrado[1];

    let numero =
        Number.isFinite(
            Number(
                numeroTexto,
            ),
        )
            ? Number(
                numeroTexto,
            )
            : NUMEROS_EXTENSO[
                compactarEstrutura(
                    numeroTexto,
                )
            ] ??
              romanoParaNumero(
                  numeroTexto,
              );

    if (
        !Number.isFinite(
            numero,
        ) ||
        numero <= 0
    ) {
        return null;
    }

    const original =
        String(
            valor ?? "",
        ).trim();

    const tituloDepois =
        original
            .replace(
                /^(?:cap[ií]tulo|cap\.?)\s+[A-Za-zÀ-ÿ0-9]+(?:\s*[:.\-–—]\s*|\s+)?/i,
                "",
            )
            .trim();

    return {
        numero,
        titulo:
            tituloDepois ||
            `Capítulo ${numero}`,
    };
}


function tituloPlausivel(
    bloco,
) {
    if (!bloco) {
        return false;
    }

    const texto =
        String(
            bloco.texto ?? "",
        ).trim();

    if (
        !texto ||
        texto.length < 2 ||
        texto.length > 130
    ) {
        return false;
    }

    /*
     * Um título real não deveria
     * parecer um parágrafo inteiro.
     */
    const palavras =
        texto
            .split(/\s+/)
            .filter(Boolean);

    if (
        palavras.length > 18
    ) {
        return false;
    }

    /*
     * Preferimos o que o processador
     * já classificou como título.
     */
    return (
        bloco.tipo ===
        "titulo"
    );
}


const SECOES_RECONHECIDAS =
    new Map([
        [
            "PREFACIO",
            "Prefácio",
        ],
        [
            "INTRODUCAO",
            "Introdução",
        ],
        [
            "PROLOGO",
            "Prólogo",
        ],
        [
            "EPILOGO",
            "Epílogo",
        ],
        [
            "CONCLUSAO",
            "Conclusão",
        ],
        [
            "POSFACIO",
            "Posfácio",
        ],
        [
            "AGRADECIMENTOS",
            "Agradecimentos",
        ],
        [
            "GUIA DE ESTUDO E DISCUSSAO",
            "Guia de estudo e discussão",
        ],
    ]);


function identificarSecao(
    texto,
) {
    const normalizado =
        normalizarEstrutura(
            texto,
        );

    return (
        SECOES_RECONHECIDAS.get(
            normalizado,
        ) ??
        null
    );
}


function contarCapitulosExplicitosPagina(
    pagina,
) {
    return (
        pagina?.blocos ??
        []
    ).filter(
        (bloco) =>
            Boolean(
                extrairCapituloExplicito(
                    bloco?.texto,
                ),
            ),
    ).length;
}


/*
 * =========================================
 * API PRINCIPAL
 * =========================================
 */

export function detectarCapitulosLivro(
    paginas = [],
) {
    if (
        !Array.isArray(
            paginas,
        ) ||
        paginas.length === 0
    ) {
        return [];
    }

    const candidatosCapitulo =
        [];

    const secoes = [];

    for (
        const pagina
        of paginas
    ) {
        const numeroPagina =
            Number(
                pagina?.numero,
            );

        const blocos =
            Array.isArray(
                pagina?.blocos,
            )
                ? pagina.blocos
                : [];

        if (
            !Number.isFinite(
                numeroPagina,
            )
        ) {
            continue;
        }

        const quantidadeExplicitos =
            contarCapitulosExplicitosPagina(
                pagina,
            );

        for (
            let indice = 0;
            indice <
            blocos.length;
            indice += 1
        ) {
            const bloco =
                blocos[indice];

            const texto =
                String(
                    bloco?.texto ??
                    "",
                ).trim();

            if (!texto) {
                continue;
            }

            /*
             * ---------------------------------
             * SEÇÕES ESPECIAIS
             * ---------------------------------
             */
            const secao =
                identificarSecao(
                    texto,
                );

            if (
                secao &&
                bloco.tipo ===
                    "titulo"
            ) {
                secoes.push({
                    id:
                        `secao-${numeroPagina}-${indice}`,

                    tipo:
                        "SECAO",

                    numero:
                        null,

                    titulo:
                        secao,

                    pagina:
                        numeroPagina,

                    bloco:
                        indice,

                    score:
                        90,
                });
            }

            /*
             * ---------------------------------
             * CAPÍTULO EXPLÍCITO
             *
             * Capítulo 1: ...
             * CAPÍTULO XII ...
             * ---------------------------------
             */
            const explicito =
                extrairCapituloExplicito(
                    texto,
                );

            if (explicito) {
                let score = 75;

                /*
                 * Cabeçalhos no começo
                 * da página são mais fortes.
                 */
                if (indice <= 2) {
                    score += 15;
                }

                /*
                 * Vários "Capítulo X" na
                 * mesma página normalmente
                 * significam sumário,
                 * guia de estudo etc.
                 */
                if (
                    quantidadeExplicitos >=
                    2
                ) {
                    score -= 30;
                }

                candidatosCapitulo.push({
                    id:
                        `capitulo-explicito-${numeroPagina}-${indice}`,

                    tipo:
                        "CAPITULO",

                    numero:
                        explicito.numero,

                    titulo:
                        explicito.titulo,

                    pagina:
                        numeroPagina,

                    bloco:
                        indice,

                    score,
                });

                continue;
            }

            /*
             * ---------------------------------
             * CAPÍTULO EM DUAS LINHAS
             *
             * U M
             * “Posso realmente conhecê-lo?”
             *
             * D OIS
             * De Jaffa aos confins da Terra
             * ---------------------------------
             */
            if (
                bloco.tipo !==
                    "titulo" ||
                indice > 3
            ) {
                continue;
            }

            const numero =
                extrairNumeroSimples(
                    texto,
                );

            if (!numero) {
                continue;
            }

            const proximo =
                blocos[
                    indice + 1
                ];

            if (
                !tituloPlausivel(
                    proximo,
                )
            ) {
                continue;
            }

            candidatosCapitulo.push({
                id:
                    `capitulo-pareado-${numeroPagina}-${indice}`,

                tipo:
                    "CAPITULO",

                numero,

                titulo:
                    String(
                        proximo.texto,
                    ).trim(),

                pagina:
                    numeroPagina,

                bloco:
                    indice,

                blocoTitulo:
                    indice + 1,

                score:
                    110,
            });
        }
    }

    /*
     * Pode existir o mesmo capítulo
     * novamente no Sumário ou em um
     * guia de estudo.
     *
     * Mantemos o candidato de maior score.
     */
    const melhoresPorNumero =
        new Map();

    candidatosCapitulo.forEach(
        (candidato) => {
            const atual =
                melhoresPorNumero.get(
                    candidato.numero,
                );

            if (
                !atual ||
                candidato.score >
                    atual.score ||
                (
                    candidato.score ===
                        atual.score &&
                    candidato.pagina <
                        atual.pagina
                )
            ) {
                melhoresPorNumero.set(
                    candidato.numero,
                    candidato,
                );
            }
        },
    );

    const capitulos =
        Array.from(
            melhoresPorNumero.values(),
        );

    /*
     * Evitar seção duplicada.
     */
    const secoesUnicas =
        [];

    const chavesSecao =
        new Set();

    secoes.forEach(
        (secao) => {
            const chave =
                `${normalizarEstrutura(
                    secao.titulo,
                )}-${secao.pagina}`;

            if (
                chavesSecao.has(
                    chave,
                )
            ) {
                return;
            }

            chavesSecao.add(
                chave,
            );

            secoesUnicas.push(
                secao,
            );
        },
    );

    return [
        ...capitulos,
        ...secoesUnicas,
    ]
        .sort(
            (a, b) =>
                a.pagina -
                    b.pagina ||
                a.bloco -
                    b.bloco,
        )
        .map(
            (
                item,
                indice,
            ) => ({
                ...item,

                ordem:
                    indice + 1,
            }),
        );
}