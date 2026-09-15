import {
  useEffect,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  X,
} from "lucide-react";

import {
  buscarPassagemBiblica,
} from "../lib/bibleApi";

function BiblePassageModal({
  referencia,
  onClose,
}) {
  const [passagem, setPassagem] =
    useState(null);

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    if (!referencia) return;

    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      setPassagem(null);

      try {
        const resultado =
          await buscarPassagemBiblica(
            referencia,
          );

        if (ativo) {
          setPassagem(resultado);
        }
      } catch (error) {
        console.error(error);

        if (ativo) {
          setErro(
            "Não conseguimos carregar o texto bíblico.",
          );
        }
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
  }, [referencia]);

  useEffect(() => {
    if (!referencia) return;

    function teclado(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      teclado,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        teclado,
      );
    };
  }, [
    referencia,
    onClose,
  ]);

  if (!referencia) {
    return null;
  }

  const modal = (
    <div
      className="verse-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <article className="verse-card">
        <header className="verse-header">
          <div>
            <span>
              Referência bíblica
            </span>

            <h2>
              {referencia.referencia}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="verse-content">
          {carregando && (
            <div className="verse-loading">
              <div className="loading-dot" />

              <p>
                Abrindo a Bíblia...
              </p>
            </div>
          )}

          {erro && (
            <div className="verse-error">
              {erro}
            </div>
          )}

          {!carregando &&
            passagem?.versos?.map(
              (verso) => (
                <p
                  key={
                    `${verso.numero}-${verso.nome}`
                  }
                  className="verse-text"
                >
                  <sup>
                    {verso.numero}
                  </sup>

                  {verso.texto}
                </p>
              ),
            )}
        </div>

        {passagem && (
          <footer className="verse-footer">
            <span>
              {passagem.traducao}
            </span>

            <span>
              Texto em domínio público
            </span>
          </footer>
        )}
      </article>
    </div>
  );

  return createPortal(
    modal,
    document.body,
  );
}

export default BiblePassageModal;