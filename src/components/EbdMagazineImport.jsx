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

import { supabase } from "../lib/supabase";
import { uploadArquivoSeguro } from "../lib/uploadArquivoSeguro";

function tituloPeloArquivo(nome) {
  return String(nome ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
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

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    if (!aberto) {
      return;
    }

    setArquivo(null);
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

  function selecionarArquivo(event) {
    const selecionado =
      event.target.files?.[0] ??
      null;

    setErro("");

    if (!selecionado) {
      setArquivo(null);
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
      setArquivo(null);
      setErro(
        "A revista precisa estar em PDF.",
      );
      return;
    }

    if (
      selecionado.size >
      50 * 1024 * 1024
    ) {
      setArquivo(null);
      setErro(
        "O PDF deve ter no máximo 50 MB.",
      );
      return;
    }

    /*
     * A seleção precisa responder imediatamente no celular.
     * Não lemos o PDF inteiro neste momento.
     *
     * Revistas grandes podem consumir muita memória quando
     * são abertas localmente logo após voltar do seletor de
     * arquivos. O número real de páginas será detectado pelo
     * leitor após o upload, usando a URL armazenada.
     */
    setArquivo(selecionado);

    if (!revistaAtual?.id) {
      const tituloArquivo =
        tituloPeloArquivo(
          selecionado.name,
        );

      if (tituloArquivo) {
        setTitulo(
          tituloArquivo,
        );
      }
    }
  }

  async function importar(event) {
    event.preventDefault();

    if (
      !user?.id ||
      !trimestre?.id ||
      !arquivo ||
      !titulo.trim()
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

      /*
       * O leitor corrige este valor assim que abrir
       * o PDF e conhecer o número real de páginas.
       */
      total_paginas:
        revistaAtual?.total_paginas ??
        1,

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
            Selecione o PDF e confirme. O VERBO preserva o layout original da revista e detecta as páginas ao abrir o leitor.
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
                      ).toFixed(1)} MB · arquivo pronto para enviar`
                    : "Arquivo de até 50 MB"}
                </span>
              </div>
            </div>
          </label>

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
              placeholder="Ex.: Lições Bíblicas"
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
                !arquivo ||
                !titulo.trim()
              }
            >
              {salvando
                ? "Enviando revista..."
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
