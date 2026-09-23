export const FORMATOS_SUPORTADOS = {
  livros: {
    extensoes: ["pdf", "epub"],
    mimeTypes: [
      "application/pdf",
      "application/epub+zip",
    ],
    accept: "application/pdf,.pdf,application/epub+zip,.epub",
  },

  sermoes: {
    extensoes: ["pdf", "docx"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    accept:
      "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
  },

  ebd: {
    extensoes: ["pdf", "pptx"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    accept:
      "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx",
  },
};

export function extensaoArquivo(nome = "") {
  const partes = String(nome)
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(".");

  return partes.length > 1
    ? partes.pop()
    : "";
}

export function formatoArquivo(arquivo) {
  const extensao = extensaoArquivo(
    arquivo?.name,
  );

  if (extensao) {
    return extensao;
  }

  const mime = arquivo?.type;

  if (mime === "application/pdf") {
    return "pdf";
  }

  if (mime === "application/epub+zip") {
    return "epub";
  }

  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }

  return "";
}

export function mimeTypeArquivo(
  arquivo,
) {
  const formato = formatoArquivo(
    arquivo,
  );

  const porFormato = {
    pdf: "application/pdf",
    epub: "application/epub+zip",
    docx:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  return (
    porFormato[formato] ||
    arquivo?.type ||
    "application/octet-stream"
  );
}

export function arquivoPermitido(
  arquivo,
  modulo,
) {
  if (!arquivo) {
    return false;
  }

  const config =
    FORMATOS_SUPORTADOS[modulo];

  if (!config) {
    return false;
  }

  return config.extensoes.includes(
    formatoArquivo(arquivo),
  );
}

export function descricaoFormatos(
  modulo,
) {
  return (
    FORMATOS_SUPORTADOS[modulo]
      ?.extensoes
      ?.map((item) =>
        item.toLocaleUpperCase(
          "pt-BR",
        ),
      )
      .join(" ou ") ||
    "arquivo"
  );
}
