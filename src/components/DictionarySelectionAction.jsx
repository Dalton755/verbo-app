import {
  BookOpen,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  ehUmaPalavraSelecionada,
  normalizarPalavraSelecionada,
} from "../lib/dictionaryService";

function limitar(
  valor,
  minimo,
  maximo,
) {
  return Math.min(
    Math.max(
      valor,
      minimo,
    ),
    maximo,
  );
}

function DictionarySelectionAction({
  containerSelector,
  disabled = false,
  onOpen,
}) {
  const [
    selecao,
    setSelecao,
  ] = useState(null);

  useEffect(() => {
    if (disabled) {
      setSelecao(null);
      return;
    }

    let timer = null;

    function verificarSelecao() {
      if (timer) {
        clearTimeout(
          timer,
        );
      }

      timer =
        setTimeout(
          () => {
            const selection =
              window.getSelection();

            if (
              !selection ||
              selection.isCollapsed ||
              selection.rangeCount ===
                0
            ) {
              setSelecao(null);
              return;
            }

            const texto =
              selection
                .toString()
                .replace(
                  /\s+/g,
                  " ",
                )
                .trim();

            if (
              !ehUmaPalavraSelecionada(
                texto,
              )
            ) {
              setSelecao(null);
              return;
            }

            const range =
              selection.getRangeAt(
                0,
              );

            const no =
              range
                .commonAncestorContainer;

            const elemento =
              no.nodeType ===
              Node.ELEMENT_NODE
                ? no
                : no.parentElement;

            const container =
              elemento?.closest?.(
                containerSelector,
              );

            if (!container) {
              setSelecao(null);
              return;
            }

            const rect =
              range
                .getBoundingClientRect();

            if (
              !rect ||
              (
                rect.width === 0 &&
                rect.height === 0
              )
            ) {
              setSelecao(null);
              return;
            }

            const palavra =
              normalizarPalavraSelecionada(
                texto,
              );

            const larguraBotao =
              132;

            const left =
              limitar(
                rect.left +
                  rect.width /
                    2 -
                  larguraBotao /
                    2,
                10,
                window.innerWidth -
                  larguraBotao -
                  10,
              );

            const top =
              rect.top > 70
                ? Math.max(
                    10,
                    rect.top -
                      52,
                  )
                : Math.min(
                    window.innerHeight -
                      54,
                    rect.bottom +
                      10,
                  );

            setSelecao({
              palavra,
              top,
              left,
            });
          },
          100,
        );
    }

    document.addEventListener(
      "selectionchange",
      verificarSelecao,
    );

    window.addEventListener(
      "scroll",
      verificarSelecao,
      {
        passive: true,
      },
    );

    return () => {
      document.removeEventListener(
        "selectionchange",
        verificarSelecao,
      );

      window.removeEventListener(
        "scroll",
        verificarSelecao,
      );

      if (timer) {
        clearTimeout(
          timer,
        );
      }
    };
  }, [
    containerSelector,
    disabled,
  ]);

  if (
    disabled ||
    !selecao
  ) {
    return null;
  }

  return (
    <button
      type="button"
      className="dictionary-selection-action"
      style={{
        top:
          `${selecao.top}px`,

        left:
          `${selecao.left}px`,
      }}
      onMouseDown={(
        event,
      ) =>
        event.preventDefault()
      }
      onPointerDown={(
        event,
      ) =>
        event.preventDefault()
      }
      onClick={() => {
        onOpen?.(
          selecao.palavra,
        );

        setSelecao(null);

        window
          .getSelection()
          ?.removeAllRanges();
      }}
    >
      <BookOpen size={16} />

      <span>
        Significado
      </span>
    </button>
  );
}

export default DictionarySelectionAction;
