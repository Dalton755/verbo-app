import fs from "fs";
import path from "path";

const BASE_URL =
    "https://bibliaalmeida.com/";

const OUTPUT_DIR =
    "./scripts/data/biblia-site-assets";

const TERMOS = [
    "dicion",
    "moderniz",
    "ortograf",
    "propheta",
    "n'elle",
    "valle",
    "9597",
    "9601",
    "9.597",
    "9.601",
];

fs.mkdirSync(
    OUTPUT_DIR,
    {
        recursive: true,
    },
);

function limparNomeArquivo(url, indice) {
    try {
        const parsed =
            new URL(url);

        const nome =
            path.basename(
                parsed.pathname,
            ) || `asset-${indice}.js`;

        return (
            `${String(indice).padStart(3, "0")}-` +
            nome.replace(
                /[^a-zA-Z0-9._-]/g,
                "_",
            )
        );
    } catch {
        return `asset-${indice}.js`;
    }
}

async function baixar(url) {
    const response =
        await fetch(
            url,
            {
                headers: {
                    "User-Agent":
                        "BibliaSlidesInspector/1.0",
                },
            },
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`,
        );
    }

    return await response.text();
}

function extrairAssets(html) {
    const encontrados =
        new Set();

    const regex =
        /<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/giu;

    let match;

    while (
        (match = regex.exec(html)) !==
        null
    ) {
        const caminho =
            match[1];

        if (
            !/\.(?:js|mjs)(?:\?|$)/i.test(
                caminho,
            )
        ) {
            continue;
        }

        encontrados.add(
            new URL(
                caminho,
                BASE_URL,
            ).href,
        );
    }

    return [
        ...encontrados,
    ];
}

function procurarTermos(
    conteudo,
) {
    const texto =
        conteudo.toLowerCase();

    return TERMOS.filter(
        (termo) =>
            texto.includes(
                termo.toLowerCase(),
            ),
    );
}

function extrairPossiveisJson(
    conteudo,
    origemUrl,
) {
    const encontrados =
        new Set();

    const regex =
        /["'`](\/?[^"'` ]+\.json(?:\?[^"'`]*)?)["'`]/giu;

    let match;

    while (
        (match = regex.exec(conteudo)) !==
        null
    ) {
        try {
            encontrados.add(
                new URL(
                    match[1],
                    origemUrl,
                ).href,
            );
        } catch {
            // ignora
        }
    }

    return [
        ...encontrados,
    ];
}

async function executar() {
    console.log("");
    console.log(
        "INSPEÇÃO DO BÍBLIA ALMEIDA",
    );

    console.log(
        "Buscando dicionário/arquivos de modernização...",
    );

    console.log("");

    const html =
        await baixar(
            BASE_URL,
        );

    fs.writeFileSync(
        path.join(
            OUTPUT_DIR,
            "homepage.html",
        ),
        html,
        "utf8",
    );

    const termosHomepage =
        procurarTermos(html);

    console.log(
        `Termos encontrados no HTML: ${
            termosHomepage.join(", ") ||
            "nenhum"
        }`,
    );

    const assets =
        extrairAssets(html);

    console.log(
        `Arquivos JS encontrados: ${assets.length}`,
    );

    const candidatos = [];
    const jsons =
        new Set();

    for (
        let indice = 0;
        indice < assets.length;
        indice += 1
    ) {
        const url =
            assets[indice];

        process.stdout.write(
            `[${indice + 1}/${assets.length}] ${url} ... `,
        );

        try {
            const conteudo =
                await baixar(url);

            const nomeArquivo =
                limparNomeArquivo(
                    url,
                    indice + 1,
                );

            fs.writeFileSync(
                path.join(
                    OUTPUT_DIR,
                    nomeArquivo,
                ),
                conteudo,
                "utf8",
            );

            const termos =
                procurarTermos(
                    conteudo,
                );

            const jsonEncontrados =
                extrairPossiveisJson(
                    conteudo,
                    url,
                );

            for (
                const jsonUrl
                of jsonEncontrados
            ) {
                jsons.add(
                    jsonUrl,
                );
            }

            if (
                termos.length > 0
            ) {
                candidatos.push({
                    arquivo:
                        nomeArquivo,

                    url,

                    termos:
                        termos.join(
                            ", ",
                        ),

                    tamanho:
                        conteudo.length,
                });

                console.log(
                    `CANDIDATO → ${termos.join(", ")}`,
                );
            } else {
                console.log(
                    "OK",
                );
            }
        } catch (error) {
            console.log(
                `ERRO: ${error.message}`,
            );
        }
    }

    console.log("");
    console.log(
        "================================",
    );

    console.log(
        `Candidatos encontrados: ${candidatos.length}`,
    );

    console.log(
        "================================",
    );

    if (
        candidatos.length > 0
    ) {
        console.table(
            candidatos,
        );
    }

    if (
        jsons.size > 0
    ) {
        console.log("");
        console.log(
            "ARQUIVOS JSON REFERENCIADOS:",
        );

        for (
            const url
            of jsons
        ) {
            console.log(url);
        }
    }

    fs.writeFileSync(
        path.join(
            OUTPUT_DIR,
            "candidatos.json",
        ),

        JSON.stringify(
            {
                candidatos,
                jsons: [
                    ...jsons,
                ],
            },
            null,
            2,
        ),

        "utf8",
    );

    console.log("");
    console.log(
        "Resultado salvo em:",
    );

    console.log(
        "scripts/data/biblia-site-assets/candidatos.json",
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