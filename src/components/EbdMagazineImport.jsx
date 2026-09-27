import {
  useEffect,
  useState,
} from "react";

import {
  BookOpenCheck,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";

import * as pdfjsLib
  from "pdfjs-dist";

import pdfWorker
  from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { supabase } from "../lib/supabase";
import { uploadArquivoSeguro } from "../lib/uploadArquivoSeguro";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

function limparTitulo(
  valor,
) {
  return String(
    valor ?? "",
  )
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function EbdMagazineImport({
  aberto,
  trimestre,
  user,
  revistaAtual = null,
  onClose,
  onImported,
}) {
  const [arquivo, setArquivo] =
    useState(null);

  const [titulo, setTitulo] =
    useState("");

  const [totalPaginas, setTotalPaginas] =
    useState(null);

  const [analisando, setAnalisando] =
    useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    if (!aberto) {
      return;
    }

    setArquivo(null);
    setTotalPaginas(null);
    setAnalisando(false);
    setSalvando(false);
    setErro("");

    setTitulo(
      revistaAtual?.titulo ||
      trimestre?.tema ||
      "Revista EBD",
    );
  }, [
    aberto,
    revistaAtual,
    trimestre,
  ]);

  if (!aberto) {
    return null;
  }

  async function selecionarArquivo(
    event,
  ) {
    const selecionado =
      event.target.files?.[0] ??
      null;

    setArquivo(selecionado);
    setTotalPaginas(null);
    setErro("");

    if (!selecionado) {
      return;
    }

    const ehPdf =
      selecionado.type ===
        "application/pdf" ||
      selecionado.name
        .toLocaleLowerCase(
          "pt-BR",
        )
        .endsWith(".pdf");

    if (!ehPdf) {
      setErro(
        "A revista precisa estar em PDF.",
      );

      return;
    }

    if (
      selecionado.size >
      50 * 1024 * 1024
    ) {
      setErro(
        "O PDF deve ter no máximo 50 MB.",
      );

      return;
    }

    setAnalisando(true);

    let pdf = null;

    try {
      const buffer =
        await selecionado.arrayBuffer();

      pdf =
        await pdfjsLib
          .getDocument({
            data:
              new Uint8Array(
                buffer,
              ),
          })
          .promise;

      setTotalPaginas(
        pdf.numPages,
      );

      try {
        const metadados =
          await pdf.getMetadata();

        const tituloPdf =
          limparTitulo(
            metadados?.info
              ?.Title,
          );

        if (
          tituloPdf &&
          ![
            "untitled",
            "document",
          ].includes(
            tituloPdf
              .toLocaleLowerCase(
                "pt-BR",
              ),
          )
        ) {
          setTitulo(
            tituloPdf,
          );
        }
      } catch {
        // O título do trimestre continua como fallback.
      }
    } catch (error) {
      console.error(
        "Erro ao analisar revista:",
        error,
      );

      setErro(
        "Não conseguimos abrir este PDF.",
      );

      setArquivo(null);
    } finally {
      if (
        pdf &&
        typeof pdf.destroy ===
          "function"
      ) {
        await pdf.destroy();
      }

      setAnalisando(false);
    }
  }

  async function importar(
    event,
  ) {
    event.preventDefault();

    if (
      !user?.id ||
      !trimestre?.id ||
      !arquivo ||
      !titulo.trim() ||
      !totalPaginas
    ) {
      return;
    }

    setSalvando(true);
    setErro("");

    const identificador =
      crypto.randomUUID();

    const storagePath =
      `${user.id}/${trimestre.id}/revista/${identificador}.pdf`;

    try {
      await uploadArquivoSeguro({
        arquivo,
        caminho:
          storagePath,
        formatosPermitidos: [
          "pdf",
        ],
      });
    } catch (error) {
      console.error(
        "Erro no upload da revista:",
        error,
      );

      setErro(
        error?.message ||
          "Não conseguimos enviar a revista.",
      );

      setSalvando(false);
      return;
    }

    const payload = {
      usuario_id:
        user.id,

      trimestre_id:
        trimestre.id,

      titulo:
        titulo.trim(),

      arquivo_nome:
        arquivo.name,

      storage_path:
        storagePath,

      total_paginas:
        totalPaginas,

      ultima_pagina:
        revistaAtual
          ?.ultima_pagina ??
        1,
    };

    let resultado;

    if (revistaAtual?.id) {
      resultado =
        await supabase
          .from(
            "revistas_ebd",
          )
          .update(payload)
          .eq(
            "id",
            revistaAtual.id,
          )
          .eq(
            "usuario_id",
            user.id,
          )
          .select(`
            id,
            usuario_id,
            trimestre_id,
            titulo,
            arquivo_nome,
            storage_path,
            total_paginas,
            ultima_pagina,
            created_at,
            updated_at
          `)
          .single();
    } else {
      resultado =
        await supabase
          .from(
            "revistas_ebd",
          )
          .insert(payload)
          .select(`
            id,
            usuario_id,
            trimestre_id,
            titulo,
            arquivo_nome,
            storage_path,
            total_paginas,
            ultima_pagina,
            created_at,
            updated_at
          `)
          .single();
    }

    if (resultado.error) {
      console.error(
        "Erro ao salvar revista:",
        resultado.error,
      );

      await supabase.storage
        .from(
          "biblia-slides-pdfs",
        )
        .remove([
          storagePath,
        ]);

      setErro(
        "O PDF foi enviado, mas não conseguimos vincular a revista ao trimestre.",
      );

      setSalvando(false);
      return;
    }

    if (
      revistaAtual?.storage_path &&
      revistaAtual.storage_path !==
        storagePath
    ) {
      const {
        error: removerError,
      } =
        await supabase.storage
          .from(
            "biblia-slides-pdfs",
          )
          .remove([
            revistaAtual
              .storage_path,
          ]);

      if (removerError) {
        console.warn(
          "A revista nova foi salva, mas o arquivo anterior não pôde ser removido:",
          removerError,
        );
      }
    }

    onImported?.(
      resultado.data,
    );

    setSalvando(false);
    onClose?.();
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !salvando
        ) {
          onClose?.();
        }
      }}
    >
      <div className="modal-card ebd-material-modal">
        <div className="modal-header">
          <div className="modal-icon">
            <BookOpenCheck
              size={22}
            />
          </div>

          <button
            type="button"
            className="modal-close"
            disabled={salvando}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-heading">
          <span className="app-kicker">
            Revista
          </span>

          <h2>
            {revistaAtual
              ? "Trocar revista"
              : "Adicionar revista"}
          </h2>

          <p>
            O PDF será mostrado página por página sem remontar o layout: imagens, cores, tipografia e posições permanecem como no original.
          </p>
        </div>

        <form
          className="trimestre-form"
          onSubmit={importar}
        >
          <label>
            Arquivo PDF

            <div className="pdf-picker">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onClick={(event) => {
                  event.currentTarget.value =
                    "";
                }}
                onChange={
                  selecionarArquivo
                }
              />

              <Upload size={21} />

              <div>
                <strong>
                  {arquivo
                    ? arquivo.name
                    : "Selecionar revista em PDF"}
                </strong>

                <span>
                  {arquivo
                    ? `${(
                        arquivo.size /
                        1024 /
                        1024
                      ).toFixed(1)} MB${totalPaginas
                        ? ` · ${totalPaginas} páginas`
                        : ""}`
                    : "Arquivo de até 50 MB"}
                </span>
              </div>
            </div>
          </label>

          {analisando && (
            <div className="ebd-material-status">
              Lendo a estrutura do PDF…
            </div>
          )}

          <label>
            Nome da revista

            <input
              type="text"
              value={titulo}
              onChange={(event) =>
                setTitulo(
                  event.target.value,
                )
              }
              placeholder="Ex.: Até que Ele venha"
            />
          </label>

          {erro && (
            <div className="library-message">
              {erro}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={salvando}
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={
                salvando ||
                analisando ||
                !arquivo ||
                !titulo.trim() ||
                !totalPaginas
              }
            >
              {salvando
                ? "Salvando revista..."
                : revistaAtual
                  ? "Trocar revista"
                  : "Adicionar revista"}

              {!salvando && (
                <ChevronRight
                  size={18}
                />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EbdMagazineImport;
