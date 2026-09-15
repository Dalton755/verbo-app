import { supabase } from "./supabase";

const BUCKET = "biblia-slides-pdfs";

function criarErro(
    mensagem,
    codigo = "UPLOAD_ERRO",
    detalhe = null,
) {
    const erro = new Error(mensagem);

    erro.codigo = codigo;
    erro.detalhe = detalhe;

    return erro;
}

async function lerErroFunction(erro) {
    try {
        const resposta =
            erro?.context;

        if (
            resposta &&
            typeof resposta.clone === "function"
        ) {
            return await resposta
                .clone()
                .json();
        }
    } catch {
        // Mantém fallback abaixo.
    }

    return null;
}

async function cancelarReserva(
    reservaId,
    motivo,
) {
    if (!reservaId) {
        return;
    }

    const {
        data,
        error,
    } =
        await supabase
            .schema("biblia_slides")
            .rpc(
                "cancelar_upload",
                {
                    p_reserva_id:
                        reservaId,

                    p_motivo:
                        motivo ??
                        "Falha durante o upload",
                },
            )
            .single();

    if (error) {
        console.error(
            "Não foi possível cancelar a reserva:",
            error,
        );

        return;
    }

    if (!data?.ok) {
        console.warn(
            "Reserva não cancelada:",
            data,
        );
    }
}

async function confirmarReserva(
    reservaId,
) {
    const {
        data,
        error,
    } =
        await supabase
            .schema("biblia_slides")
            .rpc(
                "confirmar_upload",
                {
                    p_reserva_id:
                        reservaId,
                },
            )
            .single();

    if (error) {
        throw criarErro(
            "O PDF foi enviado, mas não foi possível confirmar o armazenamento.",
            "ERRO_CONFIRMAR_UPLOAD",
            error,
        );
    }

    if (!data?.ok) {
        throw criarErro(
            data?.mensagem ??
                "Não foi possível confirmar o armazenamento do PDF.",
            data?.codigo ??
                "ERRO_CONFIRMAR_UPLOAD",
            data,
        );
    }

    return data;
}

export async function uploadPdfSeguro({
    arquivo,
    caminho,
}) {
    if (!arquivo) {
        throw criarErro(
            "Nenhum PDF foi selecionado.",
            "ARQUIVO_AUSENTE",
        );
    }

    if (
        !Number.isSafeInteger(
            arquivo.size,
        ) ||
        arquivo.size <= 0
    ) {
        throw criarErro(
            "O arquivo selecionado possui tamanho inválido.",
            "TAMANHO_INVALIDO",
        );
    }

    if (
        arquivo.type &&
        arquivo.type !==
            "application/pdf"
    ) {
        throw criarErro(
            "Somente arquivos PDF são permitidos.",
            "TIPO_INVALIDO",
        );
    }

    if (
        typeof caminho !== "string" ||
        !caminho.trim()
    ) {
        throw criarErro(
            "O caminho do PDF é inválido.",
            "CAMINHO_INVALIDO",
        );
    }

    /*
     * 1. Reserva o espaço no backend.
     */
    const {
        data: autorizacao,
        error: erroAutorizacao,
    } =
        await supabase.functions.invoke(
            "autorizar-upload",
            {
                body: {
                    caminho:
                        caminho.trim(),

                    arquivoBytes:
                        arquivo.size,
                },
            },
        );

    if (erroAutorizacao) {
        const detalhe =
            await lerErroFunction(
                erroAutorizacao,
            );

        throw criarErro(
            detalhe?.erro ??
                erroAutorizacao.message ??
                "Não foi possível autorizar o upload.",

            detalhe?.codigo ??
                "ERRO_AUTORIZAR_UPLOAD",

            detalhe,
        );
    }

    if (!autorizacao?.ok) {
        throw criarErro(
            autorizacao?.erro ??
                "O upload não foi autorizado.",

            autorizacao?.codigo ??
                "UPLOAD_NEGADO",

            autorizacao,
        );
    }

    const reservaId =
        autorizacao.reservaId;

    if (!reservaId) {
        throw criarErro(
            "O servidor não retornou a reserva do upload.",
            "RESERVA_AUSENTE",
            autorizacao,
        );
    }

    let uploadConcluido = false;

    try {
        /*
         * 2. IMPORTANTE:
         *
         * Não passamos File/Blob diretamente.
         *
         * File/Blob seria convertido pelo SDK
         * para multipart/form-data.
         *
         * ArrayBuffer mantém o PDF como corpo
         * binário do upload.
         */
        const conteudo =
            await arquivo.arrayBuffer();

        const {
            data: uploadData,
            error: uploadError,
        } =
            await supabase.storage
                .from(BUCKET)
                .upload(
                    caminho.trim(),
                    conteudo,
                    {
                        contentType:
                            "application/pdf",

                        upsert: false,
                    },
                );

        if (uploadError) {
            throw criarErro(
                "Não conseguimos enviar o PDF.",
                "ERRO_STORAGE",
                uploadError,
            );
        }

        uploadConcluido = true;

        /*
         * 3. Só confirma depois que o Storage
         * realmente aceitou o arquivo.
         */
        const confirmacao =
            await confirmarReserva(
                reservaId,
            );

        return {
            data: uploadData,

            reserva:
                confirmacao,

            armazenamento:
                autorizacao.armazenamento,
        };
    } catch (erro) {
        /*
         * Se o Storage ainda NÃO recebeu o PDF,
         * liberamos imediatamente a reserva.
         */
        if (!uploadConcluido) {
            await cancelarReserva(
                reservaId,

                erro?.message ??
                    "Falha durante o upload",
            );
        }

        throw erro;
    }
}
