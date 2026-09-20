import * as pdfjsLib
    from "pdfjs-dist";

import pdfWorker
    from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorker;


function limparTexto(
    valor,
) {
    return String(
        valor ?? "",
    )
        .replace(/\0/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


function pareceValorGenerico(
    valor,
) {
    const texto =
        limparTexto(
            valor,
        ).toLowerCase();

    if (!texto) {
        return true;
    }

    return [
        "untitled",
        "sem título",
        "sem titulo",
        "unknown",
        "desconhecido",
        "document",
        "documento",
    ].includes(
        texto,
    );
}


function dadosPeloNomeArquivo(
    nomeArquivo,
) {
    const nomeLimpo =
        limparTexto(
            String(
                nomeArquivo ?? "",
            )
                .replace(
                    /\.pdf$/i,
                    "",
                )
                .replace(
                    /[_]+/g,
                    " ",
                ),
        );

    /*
     * Exemplo:
     * (John Bevere) - A Recompensa da Honra
     */
    const autorEntreParenteses =
        nomeLimpo.match(
            /^\(([^)]+)\)\s*[-–—]\s*(.+)$/u,
        );

    if (
        autorEntreParenteses
    ) {
        return {
            autor:
                limparTexto(
                    autorEntreParenteses[1],
                ),

            titulo:
                limparTexto(
                    autorEntreParenteses[2],
                ),
        };
    }

    /*
     * Exemplo:
     * John Bevere - A Recompensa da Honra
     */
    const autorAntesTitulo =
        nomeLimpo.match(
            /^([^-–—]{3,60})\s+[-–—]\s+(.{3,})$/u,
        );

    if (
        autorAntesTitulo
    ) {
        const possivelAutor =
            limparTexto(
                autorAntesTitulo[1],
            );

        const possivelTitulo =
            limparTexto(
                autorAntesTitulo[2],
            );

        /*
         * Evita interpretar qualquer título
         * com hífen como nome de autor.
         */
        const palavrasAutor =
            possivelAutor
                .split(/\s+/)
                .filter(Boolean);

        if (
            palavrasAutor.length >= 2 &&
            palavrasAutor.length <= 5
        ) {
            return {
                autor:
                    possivelAutor,

                titulo:
                    possivelTitulo,
            };
        }
    }

    return {
        autor: "",
        titulo:
            nomeLimpo,
    };
}


function criarLinhas(
    items,
) {
    const elementos =
        items
            .filter(
                (item) =>
                    typeof item?.str ===
                    "string" &&
                    item.str.trim(),
            )
            .map(
                (item) => {
                    const t =
                        item.transform ??
                        [];

                    const fonte =
                        Math.max(
                            Math.hypot(
                                Number(
                                    t[0] ?? 0,
                                ),
                                Number(
                                    t[1] ?? 0,
                                ),
                            ),

                            Math.hypot(
                                Number(
                                    t[2] ?? 0,
                                ),
                                Number(
                                    t[3] ?? 0,
                                ),
                            ),

                            1,
                        );

                    return {
                        texto:
                            limparTexto(
                                item.str,
                            ),

                        x:
                            Number(
                                t[4] ?? 0,
                            ),

                        y:
                            Number(
                                t[5] ?? 0,
                            ),

                        fonte,
                    };
                },
            )
            .sort(
                (a, b) => {
                    if (
                        Math.abs(
                            b.y -
                            a.y,
                        ) > 3
                    ) {
                        return (
                            b.y -
                            a.y
                        );
                    }

                    return (
                        a.x -
                        b.x
                    );
                },
            );

    const linhas = [];

    for (
        const item of
        elementos
    ) {
        let linha =
            linhas.find(
                (atual) =>
                    Math.abs(
                        atual.y -
                        item.y,
                    ) <= 3,
            );

        if (!linha) {
            linha = {
                y:
                    item.y,

                itens:
                    [],
            };

            linhas.push(
                linha,
            );
        }

        linha.itens.push(
            item,
        );
    }

    return linhas
        .map(
            (linha) => {
                const itens =
                    linha.itens.sort(
                        (a, b) =>
                            a.x -
                            b.x,
                    );

                return {
                    y:
                        linha.y,

                    texto:
                        limparTexto(
                            itens
                                .map(
                                    (
                                        item,
                                    ) =>
                                        item.texto,
                                )
                                .join(
                                    " ",
                                ),
                        ),

                    fonte:
                        Math.max(
                            ...itens.map(
                                (
                                    item,
                                ) =>
                                    item.fonte,
                            ),
                        ),
                };
            },
        )
        .filter(
            (linha) =>
                linha.texto,
        )
        .sort(
            (a, b) =>
                b.y -
                a.y,
        );
}


function localizarAutor(
    linhas,
) {
    for (
        let indice = 0;
        indice <
        linhas.length;
        indice += 1
    ) {
        const texto =
            linhas[
                indice
            ].texto;

        let resultado =
            texto.match(
                /^(?:autor|autora|author)\s*[:\-]\s*(.+)$/i,
            );

        if (
            resultado?.[1]
        ) {
            return limparTexto(
                resultado[1],
            );
        }

        resultado =
            texto.match(
                /^(?:por|by)\s+(.+)$/i,
            );

        if (
            resultado?.[1]
        ) {
            return limparTexto(
                resultado[1],
            );
        }

        if (
            /^(?:por|by)$/i.test(
                texto,
            ) &&
            linhas[
                indice + 1
            ]?.texto
        ) {
            return limparTexto(
                linhas[
                    indice + 1
                ].texto,
            );
        }
    }

    return "";
}


function localizarTitulo(
    linhas,
) {
    const candidatas =
        linhas.filter(
            (linha) =>
                linha.texto
                    .length >= 2 &&
                linha.texto
                    .length <= 140 &&
                !/^(?:autor|autora|author|por|by)\b/i
                    .test(
                        linha.texto,
                    ),
        );

    if (
        candidatas.length === 0
    ) {
        return "";
    }

    const maiorFonte =
        Math.max(
            ...candidatas.map(
                (linha) =>
                    linha.fonte,
            ),
        );

    const destaque =
        candidatas.filter(
            (linha) =>
                linha.fonte >=
                maiorFonte *
                0.82,
        );

    /*
     * Permite títulos quebrados
     * em duas linhas.
     */
    return limparTexto(
        destaque
            .slice(
                0,
                2,
            )
            .map(
                (linha) =>
                    linha.texto,
            )
            .join(
                " ",
            ),
    );
}


export async function extrairDadosLivro(
    arquivo,
) {
    if (!arquivo) {
        return {
            titulo: "",
            autor: "",
        };
    }

    const buffer =
        await arquivo.arrayBuffer();

    const pdf =
        await pdfjsLib
            .getDocument({
                data:
                    new Uint8Array(
                        buffer,
                    ),
            })
            .promise;

    try {
        const dadosNomeArquivo =
            dadosPeloNomeArquivo(
                arquivo.name,
            );

        let titulo =
            dadosNomeArquivo.titulo ||
            "";

        let autor =
            dadosNomeArquivo.autor ||
            "";

        /*
         * 1. Primeiro tentamos os
         * metadados internos do PDF.
         */
        try {
            const metadados =
                await pdf
                    .getMetadata();

            const info =
                metadados?.info ??
                {};

            const tituloMeta =
                limparTexto(
                    info.Title,
                );

            const autorMeta =
                limparTexto(
                    info.Author,
                );

            if (
                !titulo &&
                tituloMeta &&
                !pareceValorGenerico(
                    tituloMeta,
                )
            ) {
                titulo =
                    tituloMeta;
            }

            if (
                !autor &&
                autorMeta &&
                !pareceValorGenerico(
                    autorMeta,
                )
            ) {
                autor =
                    autorMeta;
            }
        } catch (
        error
        ) {
            console.warn(
                "PDF sem metadados utilizáveis:",
                error,
            );
        }

        /*
         * 2. Se faltar alguma informação,
         * analisamos somente a primeira página.
         */
        if (
            !titulo ||
            !autor
        ) {
            const pagina =
                await pdf.getPage(
                    1,
                );

            const conteudo =
                await pagina
                    .getTextContent();

            const linhas =
                criarLinhas(
                    conteudo.items,
                );

            if (!titulo) {
                titulo =
                    localizarTitulo(
                        linhas,
                    );
            }

            if (!autor) {
                autor =
                    localizarAutor(
                        linhas,
                    );
            }
        }

        /*
         * 3. Último recurso para o título:
         * nome do próprio PDF.
         */
        if (!titulo) {
            titulo =
                dadosNomeArquivo.titulo;
        }

        return {
            titulo:
                limparTexto(
                    titulo,
                ),

            autor:
                limparTexto(
                    autor,
                ),
        };
    } finally {
        if (
            pdf &&
            typeof pdf.destroy ===
            "function"
        ) {
            await pdf.destroy();
        }
    }
}