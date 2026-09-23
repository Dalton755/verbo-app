import {
  formatoArquivo,
} from "./fileFormats";

import {
  processarPptxAula,
} from "./pptxProcessor";

export async function processarArquivoAula(
  arquivo,
) {
  const formato =
    formatoArquivo(
      arquivo,
    );

  if (
    formato === "pdf"
  ) {
    return {
      formato: "pdf",
      versao: 1,
      totalPaginas: null,
      paginas: null,
    };
  }

  if (
    formato === "pptx"
  ) {
    return await processarPptxAula(
      arquivo,
    );
  }

  throw new Error(
    "Formato de aula não suportado.",
  );
}
