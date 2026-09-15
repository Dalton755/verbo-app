import fs from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

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
        "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.",
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

const CODIGOS_LIVROS = [
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

function chave(
    codigo,
    capitulo,
    versiculo,
) {
    return (
        `${codigo}:` +
        `${capitulo}:` +
        `${versiculo}`
    );
}

function compactarNumeros(numeros) {
    if (!numeros.length) {
        return "";
    }

    const ordenados = [
        ...new Set(numeros),
    ].sort((a, b) => a - b);

    const partes = [];

    let inicio = ordenados[0];
    let anterior = ordenados[0];

    for (
        let indice = 1;
        indice < ordenados.length;
        indice += 1
    ) {
        const atual =
            ordenados[indice];

        if (atual === anterior + 1) {
            anterior = atual;
            continue;
        }

        partes.push(
            inicio === anterior
                ? `${inicio}`
                : `${inicio}-${anterior}`,
        );

        inicio = atual;
        anterior = atual;
    }

    partes.push(
        inicio === anterior
            ? `${inicio}`
            : `${inicio}-${anterior}`,
    );

    return partes.join(", ");
}

async function carregarVersiculosBanco() {
    const registros = [];

    const TAMANHO_PAGINA = 1000;

    let inicio = 0;

    while (true) {
        const fim =
            inicio +
            TAMANHO_PAGINA -
            1;

        const {
            data,
            error,
        } = await supabase
            .from("versiculos")
            .select(`
                livro_codigo,
                livro_nome,
                capitulo,
                versiculo
            `)
            .eq(
                "versao",
                "ALM1911_ATUAL",
            )
            .order(
                "livro_ordem",
                {
                    ascending: true,
                },
            )
            .order(
                "capitulo",
                {
                    ascending: true,
                },
            )
            .order(
                "versiculo",
                {
                    ascending: true,
                },
            )
            .range(
                inicio,
                fim,
            );

        if (error) {
            throw error;
        }

        if (
            !data ||
            data.length === 0
        ) {
            break;
        }

        registros.push(...data);

        if (
            data.length <
            TAMANHO_PAGINA
        ) {
            break;
        }

        inicio +=
            TAMANHO_PAGINA;
    }

    return registros;
}

async function executar() {
    const caminhoJson =
        "./scripts/data/alm1911-original.json";

    const biblia = JSON.parse(
        fs.readFileSync(
            caminhoJson,
            "utf8",
        ),
    );

    if (!Array.isArray(biblia)) {
        throw new Error(
            "Formato inesperado do JSON.",
        );
    }

    if (biblia.length !== 66) {
        throw new Error(
            `Esperávamos 66 livros, mas encontramos ${biblia.length}.`,
        );
    }

    if (
        CODIGOS_LIVROS.length !==
        biblia.length
    ) {
        throw new Error(
            "A quantidade de códigos não corresponde aos livros.",
        );
    }

    console.log("");
    console.log(
        "AUDITORIA DA BÍBLIA",
    );
    console.log(
        "Comparando JSON original com Supabase...",
    );
    console.log("");

    const banco =
        await carregarVersiculosBanco();

    const bancoSet =
        new Set(
            banco.map(
                (item) =>
                    chave(
                        item.livro_codigo,
                        item.capitulo,
                        item.versiculo,
                    ),
            ),
        );

    const esperadoSet =
        new Set();

    const faltantes = [];

    let totalEsperado = 0;

    for (
        let indiceLivro = 0;
        indiceLivro < biblia.length;
        indiceLivro += 1
    ) {
        const livro =
            biblia[indiceLivro];

        const codigo =
            CODIGOS_LIVROS[
                indiceLivro
            ];

        for (
            let indiceCapitulo = 0;
            indiceCapitulo <
            livro.chapters.length;
            indiceCapitulo += 1
        ) {
            const capitulo =
                indiceCapitulo + 1;

            const versos =
                livro.chapters[
                    indiceCapitulo
                ];

            const faltandoCapitulo =
                [];

            for (
                let indiceVersiculo = 0;
                indiceVersiculo <
                versos.length;
                indiceVersiculo += 1
            ) {
                const versiculo =
                    indiceVersiculo + 1;

                totalEsperado += 1;

                const ref =
                    chave(
                        codigo,
                        capitulo,
                        versiculo,
                    );

                esperadoSet.add(ref);

                if (
                    !bancoSet.has(ref)
                ) {
                    faltandoCapitulo.push(
                        versiculo,
                    );
                }
            }

            if (
                faltandoCapitulo.length >
                0
            ) {
                faltantes.push({
                    ordem:
                        indiceLivro + 1,

                    livro:
                        livro.name,

                    codigo,

                    capitulo,

                    quantidade:
                        faltandoCapitulo.length,

                    versiculos:
                        compactarNumeros(
                            faltandoCapitulo,
                        ),
                });
            }
        }
    }

    const extras = [];

    for (const item of banco) {
        const ref =
            chave(
                item.livro_codigo,
                item.capitulo,
                item.versiculo,
            );

        if (
            !esperadoSet.has(ref)
        ) {
            extras.push({
                livro:
                    item.livro_nome,

                codigo:
                    item.livro_codigo,

                capitulo:
                    item.capitulo,

                versiculo:
                    item.versiculo,
            });
        }
    }

    const totalFaltantes =
        faltantes.reduce(
            (
                total,
                item,
            ) =>
                total +
                item.quantidade,
            0,
        );

    console.log(
        "================================",
    );

    console.log(
        `Versículos esperados: ${totalEsperado}`,
    );

    console.log(
        `Versículos no banco:  ${banco.length}`,
    );

    console.log(
        `Versículos faltantes: ${totalFaltantes}`,
    );

    console.log(
        `Registros extras:     ${extras.length}`,
    );

    console.log(
        "================================",
    );

    if (faltantes.length > 0) {
        console.log("");
        console.log(
            "REFERÊNCIAS FALTANTES:",
        );

        console.table(
            faltantes.map(
                (item) => ({
                    livro:
                        item.livro,

                    codigo:
                        item.codigo,

                    capitulo:
                        item.capitulo,

                    faltam:
                        item.quantidade,

                    versiculos:
                        item.versiculos,
                }),
            ),
        );
    }

    if (extras.length > 0) {
        console.log("");
        console.log(
            "REGISTROS EXTRAS:",
        );

        console.table(
            extras,
        );
    }

    const relatorio = {
        gerado_em:
            new Date().toISOString(),

        total_esperado:
            totalEsperado,

        total_banco:
            banco.length,

        total_faltantes:
            totalFaltantes,

        total_extras:
            extras.length,

        capitulos_com_faltas:
            faltantes,

        extras,
    };

    fs.writeFileSync(
        "./scripts/data/auditoria-faltantes.json",

        JSON.stringify(
            relatorio,
            null,
            2,
        ),

        "utf8",
    );

    console.log("");
    console.log(
        "Relatório salvo em:",
    );

    console.log(
        "scripts/data/auditoria-faltantes.json",
    );
}

executar()
    .catch((error) => {
        console.error("");
        console.error(
            "ERRO NA AUDITORIA:",
            error,
        );

        process.exit(1);
    });