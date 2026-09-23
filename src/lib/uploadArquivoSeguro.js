import { supabase } from "./supabase";
import {
  formatoArquivo,
  mimeTypeArquivo,
} from "./fileFormats";

const BUCKET =
  "biblia-slides-pdfs";

function redirecionarBloqueioDemo(
  codigo,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  if (
    codigo ===
    "DEMO_LIMITE_MODULO"
  ) {
    window.location.assign(
      "/acesso?motivo=limite-demo",
    );

    return true;
  }

  if (
    codigo ===
    "DEMO_EXPIRADA"
  ) {
    window.location.assign(
      "/acesso?motivo=demo-expirada",
    );

    return true;
  }

  return false;
}

function criarErro(
  mensagem,
  codigo = "UPLOAD_ERRO",
  detalhe = null,
) {
  const erro =
    new Error(mensagem);

  erro.codigo = codigo;
  erro.detalhe = detalhe;

  return erro;
}

async function lerErroFunction(
  erro,
) {
  try {
    const resposta =
      erro?.context;

    if (
      resposta &&
      typeof resposta.clone ===
        "function"
    ) {
      return await resposta
        .clone()
        .json();
    }
  } catch {
    // Mantém fallback.
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
      "O arquivo foi enviado, mas não foi possível confirmar o armazenamento.",
      "ERRO_CONFIRMAR_UPLOAD",
      error,
    );
  }

  if (!data?.ok) {
    throw criarErro(
      data?.mensagem ??
        "Não foi possível confirmar o armazenamento do arquivo.",
      data?.codigo ??
        "ERRO_CONFIRMAR_UPLOAD",
      data,
    );
  }

  return data;
}

export async function uploadArquivoSeguro({
  arquivo,
  caminho,
  formatosPermitidos = null,
}) {
  if (!arquivo) {
    throw criarErro(
      "Nenhum arquivo foi selecionado.",
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

  const formato =
    formatoArquivo(arquivo);

  if (
    Array.isArray(
      formatosPermitidos,
    ) &&
    formatosPermitidos.length > 0 &&
    !formatosPermitidos.includes(
      formato,
    )
  ) {
    throw criarErro(
      "Este formato de arquivo não é permitido neste módulo.",
      "TIPO_INVALIDO",
      {
        formato,
        formatosPermitidos,
      },
    );
  }

  if (
    typeof caminho !== "string" ||
    !caminho.trim()
  ) {
    throw criarErro(
      "O caminho do arquivo é inválido.",
      "CAMINHO_INVALIDO",
    );
  }

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

          formato,
          contentType:
            mimeTypeArquivo(
              arquivo,
            ),
        },
      },
    );

  if (erroAutorizacao) {
    const detalhe =
      await lerErroFunction(
        erroAutorizacao,
      );

    redirecionarBloqueioDemo(
      detalhe?.codigo,
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

  let uploadConcluido =
    false;

  try {
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
              mimeTypeArquivo(
                arquivo,
              ),

            upsert: false,
          },
        );

    if (uploadError) {
      throw criarErro(
        "Não conseguimos enviar o arquivo.",
        "ERRO_STORAGE",
        uploadError,
      );
    }

    uploadConcluido =
      true;

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

      formato,

      contentType:
        mimeTypeArquivo(
          arquivo,
        ),
    };
  } catch (erro) {
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
