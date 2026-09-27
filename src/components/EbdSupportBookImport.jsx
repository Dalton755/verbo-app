import {
  useEffect,
  useState,
} from "react";

import {
  BookOpen,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { extrairDadosLivro } from "../lib/bookMetadata";
import { processarArquivoLivro } from "../lib/bookFileProcessor";
import { gerarCapaLivro } from "../lib/bookCover";
import { salvarLivroCache } from "../lib/bookCache";
import { uploadArquivoSeguro } from "../lib/uploadArquivoSeguro";

function EbdSupportBookImport({
  aberto,
  trimestre,
  user,
  onClose,
  onImported,
}) {
  const [arquivo, setArquivo] =
    useState(null);

  const [titulo, setTitulo] =
    useState("");

  const [autor, setAutor] =
    useState("");

  const [identificando, setIdentificando] =
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
    setTitulo("");
    setAutor("");
    setIdentificando(false);
    setSalvando(false);
    setErro("");
  }, [aberto]);

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
        "Selecione um arquivo PDF.",
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

    setIdentificando(true);

    try {
      const dados =
        await extrairDadosLivro(
          selecionado,
        );

      setTitulo(
        dados?.titulo ?? "",
      );

      setAutor(
        dados?.autor ?? "",
      );
    } catch (error) {
      console.warn(
        "Não foi possível identificar título e autor:",
        error,
      );

      setTitulo(
        selecionado.name
          .replace(/\.pdf$/i, "")
          .replace(/[_]+/g, " ")
          .trim(),
      );
    } finally {
      setIdentificando(false);
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
      !titulo.trim()
    ) {
      return;
    }

    setSalvando(true);
    setErro("");

    let processamento;

    try {
      processamento =
        await processarArquivoLivro(
          arquivo,
        );
    } catch (error) {
      console.error(
        "Erro ao preparar livro de apoio:",
        error,
      );

      setErro(
        "Não conseguimos preparar este PDF para o leitor.",
      );

      setSalvando(false);
      return;
    }

    let capaGerada = null;

    try {
      capaGerada =
        await gerarCapaLivro(
          arquivo,
        );
    } catch (error) {
      console.warn(
        "Não foi possível gerar a capa do livro de apoio:",
        error,
      );
    }

    const identificador =
      crypto.randomUUID();

    const storagePath =
      `${user.id}/${trimestre.id}/apoio/${identificador}.pdf`;

    const capaPath =
      capaGerada
        ? `${user.id}/ebd/${trimestre.id}/apoio-${identificador}.webp`
        : null;

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
        "Erro no upload do livro de apoio:",
        error,
      );

      setErro(
        error?.message ||
          "Não conseguimos enviar o livro de apoio.",
      );

      setSalvando(false);
      return;
    }

    let capaSalvaPath = null;

    if (
      capaGerada &&
      capaPath
    ) {
      const {
        error: capaError,
      } =
        await supabase.storage
          .from(
            "verbo-capas",
          )
          .upload(
            capaPath,
            capaGerada.blob,
            {
              contentType:
                "image/webp",
              cacheControl:
                "3600",
              upsert: false,
            },
          );

      if (!capaError) {
        capaSalvaPath =
          capaPath;
      } else {
        console.warn(
          "Não foi possível salvar a capa do livro de apoio:",
          capaError,
        );
      }
    }

    const conteudoProcessado = {
      versao:
        processamento.versao,

      formato:
        processamento.formato ??
        "pdf",

      paginas:
        processamento.paginas,
    };

    const {
      data,
      error: livroError,
    } = await supabase
      .from("livros")
      .insert({
        usuario_id:
          user.id,

        trimestre_id:
          trimestre.id,

        titulo:
          titulo.trim(),

        autor:
          autor.trim() ||
          null,

        tema_id:
          null,

        arquivo_nome:
          arquivo.name,

        arquivo_tipo:
          "pdf",

        storage_path:
          storagePath,

        capa_path:
          capaSalvaPath,

        total_paginas:
          processamento
            .totalPaginas,

        ultima_pagina:
          1,

        ultima_posicao:
          0,

        conteudo_processado:
          conteudoProcessado,

        processado_em:
          new Date()
            .toISOString(),

        processador_versao:
          processamento
            .versao ?? 1,
      })
      .select(`
        id,
        titulo,
        autor,
        trimestre_id,
        arquivo_nome,
        arquivo_tipo,
        storage_path,
        capa_path,
        total_paginas,
        ultima_pagina,
        ultima_posicao,
        conteudo_processado,
        processado_em,
        processador_versao,
        created_at
      `)
      .single();

    if (livroError) {
      console.error(
        "Erro ao criar livro de apoio:",
        livroError,
      );

      await supabase.storage
        .from(
          "biblia-slides-pdfs",
        )
        .remove([
          storagePath,
        ]);

      if (capaSalvaPath) {
        await supabase.storage
          .from(
            "verbo-capas",
          )
          .remove([
            capaSalvaPath,
          ]);
      }

      setErro(
        "O PDF foi enviado, mas não conseguimos criar o livro de apoio.",
      );

      setSalvando(false);
      return;
    }

    salvarLivroCache(
      data.id,
      {
        livro: data,
        paginas:
          conteudoProcessado
            .paginas,
      },
    );

    onImported?.(
      data,
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
            <BookOpen size={22} />
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
            Livro de apoio
          </span>

          <h2>
            Adicione o PDF
          </h2>

          <p>
            O VERBO identifica nome e autor automaticamente e abre o material no mesmo leitor de livros.
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
                    : "Selecionar PDF"}
                </strong>

                <span>
                  {arquivo
                    ? `${(
                        arquivo.size /
                        1024 /
                        1024
                      ).toFixed(1)} MB`
                    : "Arquivo de até 50 MB"}
                </span>
              </div>
            </div>
          </label>

          {identificando && (
            <div className="ebd-material-status">
              Identificando nome e autor…
            </div>
          )}

          <label>
            Nome do livro

            <input
              type="text"
              value={titulo}
              onChange={(event) =>
                setTitulo(
                  event.target.value,
                )
              }
              placeholder="Identificado automaticamente"
            />
          </label>

          <label>
            Autor

            <input
              type="text"
              value={autor}
              onChange={(event) =>
                setAutor(
                  event.target.value,
                )
              }
              placeholder="Identificado automaticamente"
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
                identificando ||
                !arquivo ||
                !titulo.trim()
              }
            >
              {salvando
                ? "Preparando leitor..."
                : "Adicionar livro"}

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

export default EbdSupportBookImport;
