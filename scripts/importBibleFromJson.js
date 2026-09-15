import fs from "fs";
import dotenv from "dotenv";
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

if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
) {
    throw new Error(
        "Variáveis do Supabase não configuradas.",
    );
}

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
    "GN",
    "EX",
    "LV",
    "NM",
    "DT",
    "JS",
    "JZ",
    "RT",
    "1SM",
    "2SM",
    "1RS",
    "2RS",
    "1CR",
    "2CR",
    "ED",
    "NE",
    "ET",
    "JO",
    "SL",
    "PV",
    "EC",
    "CT",
    "IS",
    "JR",
    "LM",
    "EZ",
    "DN",
    "OS",
    "JL",
    "AM",
    "OB",
    "JN",
    "MQ",
    "NA",
    "HC",
    "SF",
    "AG",
    "ZC",
    "ML",

    "MT",
    "MC",
    "LC",
    "JOA",
    "AT",
    "RM",
    "1CO",
    "2CO",
    "GL",
    "EF",
    "FP",
    "CL",
    "1TS",
    "2TS",
    "1TM",
    "2TM",
    "TT",
    "FM",
    "HB",
    "TG",
    "1PE",
    "2PE",
    "1JO",
    "2JO",
    "3JO",
    "JD",
    "AP",
];

function criarSlug(nome) {
    return nome
        .normalize("NFD")
        .replace(
            /\p{Diacritic}/gu,
            "",
        )
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "-",
        )
        .replace(
            /^-|-$/g,
            "",
        );
}

function construirRegistros(
    biblia,
) {
    const registros = [];

    biblia.forEach(
        (
            livro,
            indiceLivro,
        ) => {
            const codigo =
                CODIGOS[
                    indiceLivro
                ];

            if (!codigo) {
                throw new Error(
                    `Código não encontrado para ${livro.n}`,
                );
            }

            livro.c.forEach(
                (
                    capitulo,
                    indiceCapitulo,
                ) => {
                    capitulo.forEach(
                        (
                            texto,
                            indiceVersiculo,
                        ) => {
                            registros.push({
                                livro_ordem:
                                    indiceLivro +
                                    1,

                                livro_codigo:
                                    codigo,

                                livro_nome:
                                    livro.n,

                                livro_slug:
                                    criarSlug(
                                        livro.n,
                                    ),

                                capitulo:
                                    indiceCapitulo +
                                    1,

                                versiculo:
                                    indiceVersiculo +
                                    1,

                                texto,

                                versao:
                                    "ALM1911_ATUAL",

                                fonte_url:
                                    "https://bibliaalmeida.com/data/alm1911m.json",
                            });
                        },
                    );
                },
            );
        },
    );

    return registros;
}

async function executar() {
    const caminho =
        "./scripts/data/alm1911-modernizada.json";

    const biblia =
        JSON.parse(
            fs.readFileSync(
                caminho,
                "utf8",
            ),
        );

    if (
        !Array.isArray(biblia) ||
        biblia.length !== 66
    ) {
        throw new Error(
            "A Bíblia deve conter exatamente 66 livros.",
        );
    }

    const registros =
        construirRegistros(
            biblia,
        );

    console.log("");
    console.log(
        `Versículos encontrados no JSON: ${registros.length}`,
    );

    if (
        registros.length !== 31101
    ) {
        throw new Error(
            `Esperávamos 31101, mas encontramos ${registros.length}.`,
        );
    }

    const TAMANHO_LOTE = 500;

    let processados = 0;

    for (
        let inicio = 0;
        inicio <
        registros.length;
        inicio += TAMANHO_LOTE
    ) {
        const lote =
            registros.slice(
                inicio,
                inicio +
                TAMANHO_LOTE,
            );

        const {
            error,
        } = await supabase
            .from("versiculos")
            .upsert(
                lote,
                {
                    onConflict:
                        "versao,livro_codigo,capitulo,versiculo",
                },
            );

        if (error) {
            throw error;
        }

        processados +=
            lote.length;

        console.log(
            `${processados}/${registros.length}`,
        );
    }

    const {
        count,
        error: countError,
    } = await supabase
        .from("versiculos")
        .select(
            "id",
            {
                count: "exact",
                head: true,
            },
        )
        .eq(
            "versao",
            "ALM1911_ATUAL",
        );

    if (countError) {
        throw countError;
    }

    console.log("");
    console.log(
        "==============================",
    );

    console.log(
        "SINCRONIZAÇÃO CONCLUÍDA",
    );

    console.log(
        `Versículos no banco: ${count}`,
    );

    console.log(
        "==============================",
    );
}

executar()
    .catch(
        (error) => {
            console.error("");
            console.error(
                "ERRO:",
                error,
            );

            process.exit(1);
        },
    );