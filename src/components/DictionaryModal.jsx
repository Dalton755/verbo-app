import {
  BookOpen,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  buscarSignificadoPalavra,
  normalizarPalavraSelecionada,
} from "../lib/dictionaryService";

function DictionaryModal({
  aberto,
  palavra,
  onClose,
}) {
  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    resultado,
    setResultado,
  ] = useState(null);

  const [
    erro,
    setErro,
  ] = useState("");

  useEffect(() => {
    if (
      !aberto ||
      !palavra
    ) {
      return;
    }

    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      setResultado(null);

      try {
        const dados =
          await buscarSignificadoPalavra(
            palavra,
          );

        if (!ativo) {
          return;
        }

        setResultado(
          dados,
        );
      } catch (error) {
        console.error(
          "Erro ao consultar dicionário:",
          error,
        );

        if (!ativo) {
          return;
        }

        setErro(
          "Não foi possível consultar o dicionário agora.",
        );
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [
    aberto,
    palavra,
  ]);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    function fecharComEsc(
      event,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose?.();
      }
    }

    window.addEventListener(
      "keydown",
      fecharComEsc,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        fecharComEsc,
      );
  }, [
    aberto,
    onClose,
  ]);

  if (!aberto) {
    return null;
  }

  const palavraLimpa =
    normalizarPalavraSelecionada(
      palavra,
    );

  const entradas =
    Array.isArray(
      resultado?.entradas,
    )
      ? resultado.entradas
      : [];

  return (
    <div
      className="dictionary-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={
        `Significado de ${palavraLimpa}`
      }
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <section className="dictionary-modal">
        <header className="dictionary-modal-header">
          <div className="dictionary-modal-title">
            <div className="dictionary-modal-icon">
              <BookOpen
                size={22}
              />
            </div>

            <div>
              <span>
                DICIONÁRIO
              </span>

              <h2>
                {palavraLimpa}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="dictionary-modal-close"
            aria-label="Fechar dicionário"
            onClick={
              onClose
            }
          >
            <X size={19} />
          </button>
        </header>

        <div className="dictionary-modal-content">
          {carregando && (
            <div className="dictionary-loading">
              <div className="dictionary-loading-dot" />

              <p>
                Buscando significado...
              </p>
            </div>
          )}

          {!carregando &&
            erro && (
              <div className="dictionary-empty">
                <strong>
                  Não conseguimos consultar agora
                </strong>

                <p>
                  {erro}
                </p>
              </div>
            )}

          {!carregando &&
            !erro &&
            resultado &&
            entradas.length ===
              0 && (
              <div className="dictionary-empty">
                <strong>
                  Palavra não encontrada
                </strong>

                <p>
                  O dicionário não retornou uma definição para “{palavraLimpa}”.
                </p>
              </div>
            )}

          {!carregando &&
            !erro &&
            entradas.length >
              0 && (
              <div className="dictionary-entry-list">
                {entradas.map(
                  (
                    entrada,
                    indice,
                  ) => (
                    <article
                      key={
                        `${entrada.palavra ?? palavraLimpa}-${indice}`
                      }
                      className="dictionary-entry"
                    >
                      {entrada.classe && (
                        <span className="dictionary-word-class">
                          {entrada.classe}
                        </span>
                      )}

                      <ol>
                        {(
                          entrada.definicoes ??
                          []
                        ).map(
                          (
                            definicao,
                            definicaoIndice,
                          ) => (
                            <li
                              key={
                                `${indice}-${definicaoIndice}`
                              }
                            >
                              {definicao}
                            </li>
                          ),
                        )}
                      </ol>
                    </article>
                  ),
                )}
              </div>
            )}
        </div>

        <footer className="dictionary-modal-footer">
          <span>
            Fonte: Dicionário Aberto
          </span>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}

export default DictionaryModal;
