import {
  formatoArquivo,
} from "./fileFormats";

import {
  processarPdfSermao,
} from "./sermonPdfProcessor";

import {
  processarDocxSermao,
} from "./docxProcessor";

export async function processarArquivoSermao(
  arquivo,
) {
  const formato =
    formatoArquivo(
      arquivo,
    );

  if (
    formato === "pdf"
  ) {
    const resultado =
      await processarPdfSermao(
        arquivo,
      );

    return {
      ...resultado,
      formato: "pdf",
    };
  }

  if (
    formato === "docx"
  ) {
    return await processarDocxSermao(
      arquivo,
    );
  }

  throw new Error(
    "Formato de sermão não suportado.",
  );
}
