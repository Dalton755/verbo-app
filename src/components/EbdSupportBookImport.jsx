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
import { uploadArquivoSeguro } from "../lib/uploadArquivoSeguro";

const LIMITE_ANALISE_LOCAL =
  8 * 1024 * 1024;

function dadosPeloNomeArquivo(
  nomeArquivo,
) {
  const nomeLimpo =
    String(
      nomeArquivo ?? "",
    )
      .replace(/\.pdf$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const autorEntreParenteses =
    nomeLimpo.match(
      /^\(([^)]+)\)\s*[-–—]\s*(.+)$/u,
    );

  if (autorEntreParenteses) {
    return {
      autor:
        autorEntreParenteses[1]
          .trim(),

      titulo:
        autorEntreParenteses[2]
          .trim(),
    };
  }

  const autorAntesTitulo =
    nomeLimpo.match(
      /^([^-–—]{3,60})\s+[-–—]\s+(.{3,})$/u,
    );

  if (autorAntesTitulo) {
    const possivelAutor =
      autorAntesTitulo[1]
        .trim();

    const palavrasAutor =
      possivelAutor
        .split(/\s+/)
        .filter(Boolean);

    if (
      palavrasAutor.length >= 2 &&
      palavrasAutor.length <= 5
    ) {
      return {
        autor:
          possivelAutor,

        titulo:
          autorAntesTitulo[2]
            .trim(),
      };
    }
  }

  return {
    autor: "",
    titulo:
      nomeLimpo,
  };
}

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
        "Selecione um arquivo PDF.",
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
     * Primeiro confirmamos a seleção imediatamente.
     * Isso é importante no Android, especialmente
     * com PDFs grandes.
     */
    setArquivo(
      selecionado,
    );

    const dadosNome =
      dadosPeloNomeArquivo(
        selecionado.name,
      );

    setTitulo(
      dadosNome.titulo,
    );

    setAutor(
      dadosNome.autor,
    );

    /*
     * PDFs pequenos ainda recebem a identificação
     * completa por metadados/primeira página.
     *
     * PDFs grandes não são lidos inteiros neste
     * momento para evitar travamento ou recarga da
     * página no celular. Nesse caso usamos o nome
     * do arquivo e o usuário pode ajustar os campos.
     */
    if (
      selecionado.size >
      LIMITE_ANALISE_LOCAL
    ) {
      setIdentificando(false);
      return;
    }

    setIdentificando(true);

    try {
      const dados =
        await extrairDadosLivro(
          selecionado,
        );

      if (dados?.titulo) {
        setTitulo(
          dados.titulo,
        );
      }

      if (dados?.autor) {
        setAutor(
          dados.autor,
        );
      }
    } catch (error) {
      console.warn(
        "Não foi possível identificar título e autor pelos metadados:",
        error,
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

    const identificador =
      crypto.randomUUID();

    const storagePath =
      `${user.id}/${trimestre.id}/apoio/${identificador}.pdf`;

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

    /*
     * O livro é registrado imediatamente após o
     * upload. O leitor do VERBO já possui fallback
     * para processar livros ainda não preparados.
     *
     * Assim evitamos processar um PDF grande duas
     * vezes antes mesmo de ele ser salvo.
     */
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
          null,

        total_paginas:
          null,

        ultima_pagina:
          1,

        ultima_posicao:
          0,

        conteudo_processado:
          null,

        processado_em:
          null,

        processador_versao:
          1,
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

      setErro(
        livroError.message ||
          "O PDF foi enviado, mas não conseguimos criar o livro de apoio.",
      );

      setSalvando(false);
      return;
    }

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
            O arquivo é reconhecido imediatamente. O VERBO identifica nome e autor quando possível e abre o material no leitor de livros.
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
                    : "Selecionar PDF"}
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

            <span className="optional-field">
              Opcional
            </span>

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
                ? "Enviando livro..."
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
