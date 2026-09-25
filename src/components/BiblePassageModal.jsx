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
  obterVersaoBiblicaPreferida,
  salvarVersaoBiblicaPreferida,
  VERSOES_BIBLICAS,
} from "../lib/bibleApi";

import DictionaryModal
  from "./DictionaryModal";

import DictionarySelectionAction
  from "./DictionarySelectionAction";

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

  const [
    versaoSelecionada,
    setVersaoSelecionada,
  ] = useState(
    obterVersaoBiblicaPreferida,
  );

  const [
    palavraDicionario,
    setPalavraDicionario,
  ] = useState("");

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
            versaoSelecionada,
          );

        if (ativo) {
          setPassagem(resultado);
        }
      } catch (error) {
        console.error(error);

        if (ativo) {
          setErro(
            "Não conseguimos carregar esta tradução agora.",
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
  }, [
    referencia,
    versaoSelecionada,
  ]);

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

  function trocarVersao(event) {
    const novaVersao =
      event.target.value;

    salvarVersaoBiblicaPreferida(
      novaVersao,
    );

    setVersaoSelecionada(
      novaVersao,
    );
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

        <div className="verse-version-bar">
          <label
            htmlFor="verse-version-select"
          >
            Tradução
          </label>

          <select
            id="verse-version-select"
            className="verse-version-select"
            value={versaoSelecionada}
            onChange={trocarVersao}
            disabled={carregando}
          >
            {VERSOES_BIBLICAS.map(
              (versao) => (
                <option
                  key={versao.id}
                  value={versao.id}
                >
                  {versao.abreviacao}
                  {" · "}
                  {versao.nome}
                </option>
              ),
            )}
          </select>
        </div>

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

        <DictionarySelectionAction
          containerSelector=".verse-content"
          disabled={
            carregando ||
            Boolean(erro)
          }
          onOpen={
            setPalavraDicionario
          }
        />

        {passagem && (
          <footer className="verse-footer">
            <span>
              <strong>
                {passagem.abreviacao}
              </strong>
              {" · "}
              {passagem.credito}
            </span>

            {passagem.fonteUrl ? (
              <a
                href={passagem.fonteUrl}
                target="_blank"
                rel="noreferrer"
              >
                Fonte oficial
              </a>
            ) : (
              <span>
                {passagem.fonte}
              </span>
            )}
          </footer>
        )}
      </article>

      <DictionaryModal
        aberto={
          Boolean(
            palavraDicionario,
          )
        }
        palavra={
          palavraDicionario
        }
        onClose={() =>
          setPalavraDicionario(
            "",
          )
        }
      />
    </div>
  );

  return createPortal(
    modal,
    document.body,
  );
}

export default BiblePassageModal;
