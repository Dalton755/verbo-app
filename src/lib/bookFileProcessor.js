import {
  formatoArquivo,
} from "./fileFormats";

import {
  processarPdfLivro,
} from "./bookPdfProcessor";

import {
  processarEpubLivro,
} from "./epubProcessor";

export async function processarArquivoLivro(
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
      await processarPdfLivro(
        arquivo,
      );

    return {
      ...resultado,
      formato: "pdf",
    };
  }

  if (
    formato === "epub"
  ) {
    return await processarEpubLivro(
      arquivo,
    );
  }

  throw new Error(
    "Formato de livro não suportado.",
  );
}
