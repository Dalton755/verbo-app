import * as pdfjsLib
    from "pdfjs-dist";

import pdfWorker
    from "pdfjs-dist/build/pdf.worker.min.mjs?url";


pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorker;


/*
 * Gera uma miniatura da primeira página
 * do PDF para ser usada como capa do livro.
 */
export async function gerarCapaLivro(
    arquivo,
) {
    if (!arquivo) {
        throw new Error(
            "Arquivo PDF não informado.",
        );
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
        const pagina =
            await pdf.getPage(
                1,
            );

        /*
         * A capa será gerada com aproximadamente
         * 420px de largura.
         *
         * É suficiente para os cards da estante
         * sem gerar uma imagem pesada.
         */
        const viewportOriginal =
            pagina.getViewport({
                scale: 1,
            });

        const larguraDesejada =
            420;

        const escala =
            larguraDesejada /
            viewportOriginal.width;

        const viewport =
            pagina.getViewport({
                scale:
                    escala,
            });

        const canvas =
            document.createElement(
                "canvas",
            );

        canvas.width =
            Math.ceil(
                viewport.width,
            );

        canvas.height =
            Math.ceil(
                viewport.height,
            );

        const contexto =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                },
            );

        if (!contexto) {
            throw new Error(
                "Não foi possível preparar a capa.",
            );
        }

        /*
         * Fundo branco evita transparência
         * quando o PDF possui áreas vazias.
         */
        contexto.fillStyle =
            "#ffffff";

        contexto.fillRect(
            0,
            0,
            canvas.width,
            canvas.height,
        );

        await pagina
            .render({
                canvasContext:
                    contexto,

                viewport,
            })
            .promise;

        const blob =
            await new Promise(
                (
                    resolve,
                    reject,
                ) => {
                    canvas.toBlob(
                        (
                            resultado,
                        ) => {
                            if (
                                resultado
                            ) {
                                resolve(
                                    resultado,
                                );

                                return;
                            }

                            reject(
                                new Error(
                                    "Não foi possível gerar a imagem da capa.",
                                ),
                            );
                        },

                        "image/webp",

                        0.82,
                    );
                },
            );

        return {
            blob,

            mimeType:
                "image/webp",

            extensao:
                "webp",

            largura:
                canvas.width,

            altura:
                canvas.height,

            tamanhoBytes:
                blob.size,
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