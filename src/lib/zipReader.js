function localizarEocd(
  view,
) {
  const assinatura =
    0x06054b50;

  const minimo =
    Math.max(
      0,
      view.byteLength -
        0xffff -
        22,
    );

  for (
    let offset =
      view.byteLength - 22;
    offset >= minimo;
    offset -= 1
  ) {
    if (
      view.getUint32(
        offset,
        true,
      ) === assinatura
    ) {
      return offset;
    }
  }

  throw new Error(
    "Arquivo ZIP inválido: diretório central não encontrado.",
  );
}

async function descompactarDeflate(
  bytes,
) {
  if (
    typeof DecompressionStream ===
    "undefined"
  ) {
    throw new Error(
      "Este navegador não oferece suporte ao descompactador necessário.",
    );
  }

  const stream =
    new Blob([bytes])
      .stream()
      .pipeThrough(
        new DecompressionStream(
          "deflate-raw",
        ),
      );

  const buffer =
    await new Response(
      stream,
    ).arrayBuffer();

  return new Uint8Array(
    buffer,
  );
}

function normalizarCaminho(
  caminho = "",
) {
  const partes = [];

  String(caminho)
    .replace(/\\/g, "/")
    .split("/")
    .forEach((parte) => {
      if (
        !parte ||
        parte === "."
      ) {
        return;
      }

      if (parte === "..") {
        partes.pop();
        return;
      }

      partes.push(parte);
    });

  return partes.join("/");
}

export function resolverCaminhoZip(
  base,
  relativo,
) {
  if (
    !relativo ||
    relativo.startsWith("/")
  ) {
    return normalizarCaminho(
      relativo,
    );
  }

  const baseNormalizada =
    normalizarCaminho(base);

  const pasta =
    baseNormalizada.includes("/")
      ? baseNormalizada
          .split("/")
          .slice(0, -1)
          .join("/")
      : "";

  return normalizarCaminho(
    [pasta, relativo]
      .filter(Boolean)
      .join("/"),
  );
}

export async function abrirZip(
  arquivoOuBuffer,
) {
  const buffer =
    arquivoOuBuffer instanceof
      ArrayBuffer
      ? arquivoOuBuffer
      : await arquivoOuBuffer
          .arrayBuffer();

  const bytes =
    new Uint8Array(buffer);

  const view =
    new DataView(buffer);

  const eocd =
    localizarEocd(view);

  const totalEntradas =
    view.getUint16(
      eocd + 10,
      true,
    );

  const offsetCentral =
    view.getUint32(
      eocd + 16,
      true,
    );

  const decoder =
    new TextDecoder(
      "utf-8",
    );

  const entradas =
    new Map();

  let cursor =
    offsetCentral;

  for (
    let indice = 0;
    indice < totalEntradas;
    indice += 1
  ) {
    if (
      view.getUint32(
        cursor,
        true,
      ) !==
      0x02014b50
    ) {
      throw new Error(
        "Arquivo ZIP inválido: entrada do diretório central corrompida.",
      );
    }

    const metodo =
      view.getUint16(
        cursor + 10,
        true,
      );

    const tamanhoComprimido =
      view.getUint32(
        cursor + 20,
        true,
      );

    const tamanhoOriginal =
      view.getUint32(
        cursor + 24,
        true,
      );

    const tamanhoNome =
      view.getUint16(
        cursor + 28,
        true,
      );

    const tamanhoExtra =
      view.getUint16(
        cursor + 30,
        true,
      );

    const tamanhoComentario =
      view.getUint16(
        cursor + 32,
        true,
      );

    const offsetLocal =
      view.getUint32(
        cursor + 42,
        true,
      );

    const nome =
      normalizarCaminho(
        decoder.decode(
          bytes.slice(
            cursor + 46,
            cursor +
              46 +
              tamanhoNome,
          ),
        ),
      );

    entradas.set(
      nome,
      {
        nome,
        metodo,
        tamanhoComprimido,
        tamanhoOriginal,
        offsetLocal,
      },
    );

    cursor +=
      46 +
      tamanhoNome +
      tamanhoExtra +
      tamanhoComentario;
  }

  async function bytesEntrada(
    caminho,
  ) {
    const nome =
      normalizarCaminho(
        caminho,
      );

    const entrada =
      entradas.get(nome);

    if (!entrada) {
      throw new Error(
        `Arquivo interno não encontrado: ${nome}`,
      );
    }

    const offset =
      entrada.offsetLocal;

    if (
      view.getUint32(
        offset,
        true,
      ) !==
      0x04034b50
    ) {
      throw new Error(
        "Arquivo ZIP inválido: cabeçalho local corrompido.",
      );
    }

    const tamanhoNome =
      view.getUint16(
        offset + 26,
        true,
      );

    const tamanhoExtra =
      view.getUint16(
        offset + 28,
        true,
      );

    const inicio =
      offset +
      30 +
      tamanhoNome +
      tamanhoExtra;

    const comprimido =
      bytes.slice(
        inicio,
        inicio +
          entrada
            .tamanhoComprimido,
      );

    if (
      entrada.metodo === 0
    ) {
      return comprimido;
    }

    if (
      entrada.metodo === 8
    ) {
      return await descompactarDeflate(
        comprimido,
      );
    }

    throw new Error(
      `Método ZIP não suportado: ${entrada.metodo}`,
    );
  }

  async function texto(
    caminho,
  ) {
    return decoder.decode(
      await bytesEntrada(
        caminho,
      ),
    );
  }

  function listar(
    prefixo = "",
  ) {
    const inicio =
      normalizarCaminho(
        prefixo,
      );

    return [
      ...entradas.keys(),
    ].filter(
      (nome) =>
        !inicio ||
        nome.startsWith(
          inicio,
        ),
    );
  }

  function existe(
    caminho,
  ) {
    return entradas.has(
      normalizarCaminho(
        caminho,
      ),
    );
  }

  return {
    listar,
    existe,
    texto,
    bytes:
      bytesEntrada,
  };
}
