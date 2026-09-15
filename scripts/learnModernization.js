import fs from "fs";
import dotenv from "dotenv";
import {
    diffWordsWithSpace,
} from "diff";

import {
    createClient,
} from "@supabase/supabase-js";

dotenv.config({
    path: ".env.import",
    quiet: true,
});

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        db: {
            schema: "biblia_slides",
        },

        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    },
);

const CODIGOS = [
    "GN", "EX", "LV", "NM", "DT",
    "JS", "JZ", "RT", "1SM", "2SM",
    "1RS", "2RS", "1CR", "2CR", "ED",
    "NE", "ET", "JO", "SL", "PV",
    "EC", "CT", "IS", "JR", "LM",
    "EZ", "DN", "OS", "JL", "AM",
    "OB", "JN", "MQ", "NA", "HC",
    "SF", "AG", "ZC", "ML",

    "MT", "MC", "LC", "JOA", "AT",
    "RM", "1CO", "2CO", "GL", "EF",
    "FP", "CL", "1TS", "2TS", "1TM",
    "2TM", "TT", "FM", "HB", "TG",
    "1PE", "2PE", "1JO", "2JO", "3JO",
    "JD", "AP",
];

async function carregarBanco() {
    const resultado = [];

    let inicio = 0;

    while (true) {
        const {
            data,
            error,
        } = await supabase
            .from("versiculos")
            .select(`
                livro_ordem,
                livro_codigo,
                capitulo,
                versiculo,
                texto
            `)
            .eq(
                "versao",
                "ALM1911_ATUAL",
            )
            .range(
                inicio,
                inicio + 999,
            );

        if (error) {
            throw error;
        }

        if (!data?.length) {
            break;
        }

        resultado.push(...data);

        if (data.length < 1000) {
            break;
        }

        inicio += 1000;
    }

    return resultado;
}

function registrarConversoes(
    original,
    moderno,
    mapa,
) {
    const partes =
        diffWordsWithSpace(
            original,
            moderno,
        );

    let removido = "";
    let adicionado = "";

    function finalizar() {
        if (
            removido &&
            adicionado &&
            removido !== adicionado
        ) {
            const origem =
                removido;

            const destino =
                adicionado;

            if (!mapa.has(origem)) {
                mapa.set(
                    origem,
                    new Map(),
                );
            }

            const destinos =
                mapa.get(origem);

            destinos.set(
                destino,
                (
                    destinos.get(destino) ??
                    0
                ) + 1,
            );
        }

        removido = "";
        adicionado = "";
    }

    for (const parte of partes) {
        if (parte.removed) {
            removido +=
                parte.value;

            continue;
        }

        if (parte.added) {
            adicionado +=
                parte.value;

            continue;
        }

        finalizar();
    }

    finalizar();
}

function construirRegras(mapa) {
    const regras = [];

    for (
        const [
            origem,
            destinos,
        ]
        of mapa
    ) {
        const ordenados =
            [...destinos.entries()]
                .sort(
                    (a, b) =>
                        b[1] - a[1],
                );

        const [
            melhorDestino,
            quantidade,
        ] = ordenados[0];

        const total =
            ordenados.reduce(
                (
                    soma,
                    item,
                ) =>
                    soma +
                    item[1],
                0,
            );

        /*
         * Só aceitamos uma regra se
         * aquela grafia tiver comportamento
         * determinístico.
         */
        if (
            ordenados.length === 1 ||
            quantidade / total >= 0.98
        ) {
            regras.push({
                origem,
                destino:
                    melhorDestino,
                ocorrencias:
                    quantidade,
                confianca:
                    quantidade / total,
            });
        }
    }

    /*
     * Frases maiores primeiro.
     *
     * Ex. "n'elle" deve ser resolvido antes
     * de uma regra menor envolvendo "elle".
     */
    regras.sort(
        (a, b) =>
            b.origem.length -
            a.origem.length,
    );

    return regras;
}

function escaparRegex(texto) {
    return texto.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
    );
}

function criarModernizador(regras) {
    /*
     * Remove regras que alteram apenas
     * espaços ou símbolos.
     *
     * Nosso interesse aqui é exclusivamente
     * a modernização ortográfica.
     */
    const regrasValidas =
        regras.filter(
            (regra) =>
                regra.origem &&
                regra.destino &&
                /\p{L}/u.test(
                    regra.origem,
                ) &&
                /\p{L}/u.test(
                    regra.destino,
                ),
        );

    /*
     * Expressões maiores primeiro.
     *
     * Exemplo:
     *
     * n'elle
     *
     * precisa ser reconhecido antes
     * de algo menor contido nele.
     */
    regrasValidas.sort(
        (a, b) =>
            b.origem.length -
            a.origem.length,
    );

    const mapa =
        new Map(
            regrasValidas.map(
                (regra) => [
                    regra.origem,
                    regra.destino,
                ],
            ),
        );

    const padrao =
        regrasValidas
            .map(
                (regra) =>
                    escaparRegex(
                        regra.origem,
                    ),
            )
            .join("|");

    const regex =
        new RegExp(
            padrao,
            "g",
        );

    /*
     * String.replace trabalha sobre
     * o TEXTO ORIGINAL.
     *
     * O resultado de uma substituição
     * não volta para o regex.
     *
     * Isso elimina o efeito cascata.
     */
    return function modernizar(
        texto,
    ) {
        return texto.replace(
            regex,
            (trecho) =>
                mapa.get(trecho) ??
                trecho,
        );
    };
}

function normalizarComparacao(
    texto,
) {
    return texto
        .replace(/\s+/g, " ")
        .trim();
}

async function executar() {
    const biblia =
        JSON.parse(
            fs.readFileSync(
                "./scripts/data/alm1911-original.json",
                "utf8",
            ),
        );

    const banco =
        await carregarBanco();

    console.log(
        `Versículos usados para aprender: ${banco.length}`,
    );

    const mapa =
        new Map();

    for (const item of banco) {
        const indiceLivro =
            CODIGOS.indexOf(
                item.livro_codigo,
            );

        if (indiceLivro < 0) {
            throw new Error(
                `Livro desconhecido: ${item.livro_codigo}`,
            );
        }

        const original =
            biblia[indiceLivro]
                ?.chapters[
            item.capitulo - 1
            ]?.[
            item.versiculo - 1
            ];

        if (!original) {
            continue;
        }

        registrarConversoes(
            original,
            item.texto,
            mapa,
        );
    }

    const regras =
        construirRegras(mapa);

    console.log(
        `Regras aprendidas: ${regras.length}`,
    );

    const modernizar =
        criarModernizador(
            regras,
        );

    let iguais = 0;
    let diferentes = 0;

    const exemplos =
        [];

    /*
     * Agora fazemos o teste decisivo:
     * aplicar as regras à própria base
     * conhecida e comparar com a versão
     * modernizada do site.
     */
    for (const item of banco) {
        const indiceLivro =
            CODIGOS.indexOf(
                item.livro_codigo,
            );

        const original =
            biblia[indiceLivro]
                ?.chapters[
            item.capitulo - 1
            ]?.[
            item.versiculo - 1
            ];

        if (!original) {
            continue;
        }

        const convertido =
            modernizar(
                original,
                
            );

        if (
            normalizarComparacao(
                convertido,
            ) ===
            normalizarComparacao(
                item.texto,
            )
        ) {
            iguais += 1;
        } else {
            diferentes += 1;

            if (
                exemplos.length < 15
            ) {
                exemplos.push({
                    referencia:
                        `${item.livro_codigo} ` +
                        `${item.capitulo}:` +
                        `${item.versiculo}`,

                    original,

                    convertido,

                    esperado:
                        item.texto,
                });
            }
        }
    }

    const percentual =
        (
            iguais /
            (iguais + diferentes)
        ) * 100;

    console.log("");
    console.log(
        "==============================",
    );

    console.log(
        `Exatos:      ${iguais}`,
    );

    console.log(
        `Diferentes:  ${diferentes}`,
    );

    console.log(
        `Precisão:    ${percentual.toFixed(3)}%`,
    );

    console.log(
        "==============================",
    );

    fs.writeFileSync(
        "./scripts/data/modernization-rules.json",

        JSON.stringify(
            regras,
            null,
            2,
        ),

        "utf8",
    );

    if (exemplos.length) {
        fs.writeFileSync(
            "./scripts/data/modernization-mismatches.json",

            JSON.stringify(
                exemplos,
                null,
                2,
            ),

            "utf8",
        );
    }

    console.log("");
    console.log(
        "Regras salvas em:",
    );

    console.log(
        "scripts/data/modernization-rules.json",
    );
}

executar()
    .catch((error) => {
        console.error(
            "ERRO:",
            error,
        );

        process.exit(1);
    });