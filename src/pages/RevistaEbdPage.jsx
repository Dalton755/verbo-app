import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import * as pdfjsLib
  from "pdfjs-dist";

import pdfWorker
  from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  extrairReferenciasBiblicas,
} from "../lib/bibleReferences";

import BiblePassageModal
  from "../components/BiblePassageModal";

import DictionaryModal
  from "../components/DictionaryModal";

import DictionarySelectionAction
  from "../components/DictionarySelectionAction";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

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

function construirCamadaTexto(
  textContent,
  viewport,
) {
  const escala =
    viewport.scale;

  const itens =
    (textContent?.items ?? [])
      .filter(
        (item) =>
          typeof item?.str ===
            "string" &&
          item.str.trim(),
      )
      .map(
        (
          item,
          indice,
        ) => {
          const matriz =
            pdfjsLib.Util.transform(
              viewport.transform,
              item.transform,
            );

          const altura =
            Math.max(
              6,
              Math.hypot(
                matriz[2],
                matriz[3],
              ),
            );

          const largura =
            Math.max(
              2,
              Number(
                item.width ?? 0,
              ) * escala,
            );

          return {
            id:
              `${indice}-${item.str.slice(0, 12)}`,

            texto:
              item.str,

            left:
              matriz[4],

            top:
              matriz[5] -
              altura,

            width:
              largura,

            height:
              altura,
          };
        },
      );

  const linhas = [];

  for (
    const item of
    [...itens].sort(
      (a, b) => {
        if (
          Math.abs(
            a.top -
            b.top,
          ) > 4
        ) {
          return (
            a.top -
            b.top
          );
        }

        return (
          a.left -
          b.left
        );
      },
    )
  ) {
    const tolerancia =
      Math.max(
        4,
        item.height *
          0.45,
      );

    let linha =
      linhas.find(
        (atual) =>
          Math.abs(
            atual.top -
            item.top,
          ) <=
          tolerancia,
      );

    if (!linha) {
      linha = {
        top:
          item.top,
        itens: [],
      };

      linhas.push(
        linha,
      );
    }

    linha.itens.push(
      item,
    );
  }

  const referencias = [];

  for (
    const linha of
    linhas
  ) {
    const ordenados =
      linha.itens.sort(
        (a, b) =>
          a.left -
          b.left,
      );

    let cursor = 0;
    let textoLinha = "";

    const segmentos =
      ordenados.map(
        (
          item,
          indice,
        ) => {
          const separador =
            indice === 0
              ? ""
              : " ";

          textoLinha +=
            separador;

          cursor +=
            separador.length;

          const inicio =
            cursor;

          textoLinha +=
            item.texto;

          cursor +=
            item.texto.length;

          return {
            ...item,
            inicio,
            fim:
              cursor,
          };
        },
      );

    const refs =
      extrairReferenciasBiblicas(
        textoLinha,
      );

    for (
      const ref of refs
    ) {
      const tocados =
        segmentos.filter(
          (segmento) =>
            segmento.fim >
              ref.indiceInicio &&
            segmento.inicio <
              ref.indiceFim,
        );

      if (
        tocados.length ===
        0
      ) {
        continue;
      }

      const esquerda =
        Math.min(
          ...tocados.map(
            (item) =>
              item.left,
          ),
        );

      const direita =
        Math.max(
          ...tocados.map(
            (item) =>
              item.left +
              item.width,
          ),
        );

      const topo =
        Math.min(
          ...tocados.map(
            (item) =>
              item.top,
          ),
        );

      const baixo =
        Math.max(
          ...tocados.map(
            (item) =>
              item.top +
              item.height,
          ),
        );

      referencias.push({
        id:
          `${ref.referencia}-${ref.indiceInicio}-${topo}`,

        ref,

        left:
          esquerda,

        top:
          topo,

        width:
          Math.max(
            16,
            direita -
              esquerda,
          ),

        height:
          Math.max(
            12,
            baixo -
              topo,
          ),
      });
    }
  }

  return {
    itens,
    referencias,
  };
}

function RevistaPagina({
  pdf,
  numero,
  onReferencia,
  onPalavra,
}) {
  const wrapRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const [
    tamanhoPagina,
    setTamanhoPagina,
  ] = useState({
    width: 0,
    height: 0,
  });

  const [
    larguraContainer,
    setLarguraContainer,
  ] = useState(0);

  const [
    camada,
    setCamada,
  ] = useState({
    itens: [],
    referencias: [],
  });

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  useEffect(() => {
    const elemento =
      wrapRef.current;

    if (!elemento) {
      return;
    }

    const observer =
      new ResizeObserver(
        () => {
          setLarguraContainer(
            elemento.clientWidth,
          );
        },
      );

    observer.observe(
      elemento,
    );

    return () =>
      observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !pdf ||
      !numero
    ) {
      return;
    }

    let ativo = true;
    let renderTask = null;

    async function renderizar() {
      setCarregando(true);

      const pagina =
        await pdf.getPage(
          numero,
        );

      if (!ativo) {
        return;
      }

      const viewportBase =
        pagina.getViewport({
          scale: 1,
        });

      const larguraDisponivel =
        Math.max(
          280,
          Math.min(
            wrapRef.current
              ?.clientWidth ??
              760,
            980,
          ),
        );

      const escala =
        limitar(
          larguraDisponivel /
            viewportBase.width,
          0.45,
          2.25,
        );

      const viewport =
        pagina.getViewport({
          scale:
            escala,
        });

      const dpr =
        limitar(
          window.devicePixelRatio ||
            1,
          1,
          2,
        );

      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const contexto =
        canvas.getContext(
          "2d",
          {
            alpha: false,
          },
        );

      canvas.width =
        Math.ceil(
          viewport.width *
            dpr,
        );

      canvas.height =
        Math.ceil(
          viewport.height *
            dpr,
        );

      canvas.style.width =
        `${viewport.width}px`;

      canvas.style.height =
        `${viewport.height}px`;

      contexto.setTransform(
        1,
        0,
        0,
        1,
        0,
        0,
      );

      renderTask =
        pagina.render({
          canvasContext:
            contexto,

          viewport,

          transform:
            dpr === 1
              ? null
              : [
                  dpr,
                  0,
                  0,
                  dpr,
                  0,
                  0,
                ],
        });

      const [
        ,
        textContent,
      ] =
        await Promise.all([
          renderTask.promise,

          pagina
            .getTextContent(),
        ]);

      if (!ativo) {
        return;
      }

      setTamanhoPagina({
        width:
          viewport.width,

        height:
          viewport.height,
      });

      setCamada(
        construirCamadaTexto(
          textContent,
          viewport,
        ),
      );

      setCarregando(false);
    }

    renderizar().catch(
      (error) => {
        if (
          error?.name ===
          "RenderingCancelledException"
        ) {
          return;
        }

        console.error(
          "Erro ao renderizar página da revista:",
          error,
        );

        if (ativo) {
          setCarregando(false);
        }
      },
    );

    return () => {
      ativo = false;

      try {
        renderTask?.cancel?.();
      } catch {
        // Render já encerrado.
      }
    };
  }, [
    pdf,
    numero,
    larguraContainer,
  ]);

  function abrirPalavraSelecionada() {
    const texto =
      window
        .getSelection()
        ?.toString()
        ?.replace(
          /\s+/g,
          " ",
        )
        ?.trim();

    if (
      texto &&
      /^[\p{L}À-ÿ'-]+$/u.test(
        texto,
      )
    ) {
      onPalavra?.(
        texto,
      );
    }
  }

  return (
    <div
      ref={wrapRef}
      className="revista-page-wrap"
    >
      {carregando && (
        <div className="revista-page-loading">
          <div className="loading-dot" />

          <span>
            Abrindo página…
          </span>
        </div>
      )}

      <div
        className="revista-interactive-page"
        style={{
          width:
            tamanhoPagina.width
              ? `${tamanhoPagina.width}px`
              : undefined,

          height:
            tamanhoPagina.height
              ? `${tamanhoPagina.height}px`
              : undefined,
        }}
        onDoubleClick={
          abrirPalavraSelecionada
        }
      >
        <canvas
          ref={canvasRef}
          className="revista-canvas"
        />

        <div
          className="revista-text-layer"
          aria-label="Camada de texto interativa"
        >
          {camada.itens.map(
            (item) => (
              <span
                key={item.id}
                className="revista-text-item"
                style={{
                  left:
                    `${item.left}px`,

                  top:
                    `${item.top}px`,

                  width:
                    `${item.width}px`,

                  height:
                    `${item.height}px`,

                  fontSize:
                    `${item.height}px`,
                }}
              >
                {item.texto}
              </span>
            ),
          )}

          {camada.referencias.map(
            (
              item,
            ) => (
              <button
                type="button"
                key={item.id}
                className="revista-reference-hit"
                style={{
                  left:
                    `${item.left}px`,

                  top:
                    `${item.top}px`,

                  width:
                    `${item.width}px`,

                  height:
                    `${item.height}px`,
                }}
                aria-label={
                  `Abrir ${item.ref.referencia}`
                }
                title={
                  item.ref
                    .referencia
                }
                onClick={() =>
                  onReferencia?.(
                    item.ref,
                  )
                }
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function RevistaEbdPage() {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const { user } =
    useAuth();

  const [
    revista,
    setRevista,
  ] = useState(null);

  const [
    pdf,
    setPdf,
  ] = useState(null);

  const [
    pagina,
    setPagina,
  ] = useState(1);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    referenciaAtiva,
    setReferenciaAtiva,
  ] = useState(null);

  const [
    palavraDicionario,
    setPalavraDicionario,
  ] = useState("");

  const [
    fullscreen,
    setFullscreen,
  ] = useState(false);

  const swipeRef =
    useRef(null);

  const total =
    revista?.total_paginas ||
    pdf?.numPages ||
    1;

  const percentual =
    useMemo(
      () =>
        total > 1
          ? (
              (
                pagina -
                1
              ) /
              (
                total -
                1
              )
            ) *
            100
          : 100,
      [
        pagina,
        total,
      ],
    );

  useEffect(() => {
    if (
      !user?.id ||
      !id
    ) {
      return;
    }

    let ativo = true;
    let documento = null;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "revistas_ebd",
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
          .eq(
            "id",
            id,
          )
          .eq(
            "usuario_id",
            user.id,
          )
          .single();

      if (
        error ||
        !data
      ) {
        console.error(
          "Erro ao abrir revista:",
          error,
        );

        if (ativo) {
          setErro(
            "Não conseguimos abrir esta revista.",
          );
          setCarregando(false);
        }

        return;
      }

      const {
        data: urlData,
        error: urlError,
      } =
        await supabase.storage
          .from(
            "biblia-slides-pdfs",
          )
          .createSignedUrl(
            data.storage_path,
            60 * 60,
          );

      if (
        urlError ||
        !urlData
          ?.signedUrl
      ) {
        console.error(
          "Erro ao gerar acesso à revista:",
          urlError,
        );

        if (ativo) {
          setErro(
            "Não conseguimos carregar o PDF da revista.",
          );
          setCarregando(false);
        }

        return;
      }

      try {
        documento =
          await pdfjsLib
            .getDocument(
              urlData
                .signedUrl,
            )
            .promise;
      } catch (pdfError) {
        console.error(
          "Erro ao ler PDF da revista:",
          pdfError,
        );

        if (ativo) {
          setErro(
            "O PDF da revista não pôde ser lido.",
          );
          setCarregando(false);
        }

        return;
      }

      if (!ativo) {
        await documento
          ?.destroy?.();
        return;
      }

      const paginaInicial =
        limitar(
          Number(
            data.ultima_pagina ??
              1,
          ),
          1,
          documento.numPages,
        );

      setRevista({
        ...data,
        total_paginas:
          documento
            .numPages,
      });

      setPdf(
        documento,
      );

      setPagina(
        paginaInicial,
      );

      setCarregando(false);
    }

    carregar();

    return () => {
      ativo = false;

      if (documento) {
        documento
          .destroy?.()
          .catch?.(
            () => {},
          );
      }
    };
  }, [
    id,
    user?.id,
  ]);

  useEffect(() => {
    if (
      !revista?.id ||
      !user?.id
    ) {
      return;
    }

    const timer =
      setTimeout(
        () => {
          supabase
            .from(
              "revistas_ebd",
            )
            .update({
              ultima_pagina:
                pagina,
            })
            .eq(
              "id",
              revista.id,
            )
            .eq(
              "usuario_id",
              user.id,
            )
            .then(
              ({
                error,
              }) => {
                if (error) {
                  console.warn(
                    "Não foi possível salvar o progresso da revista:",
                    error,
                  );
                }
              },
            );
        },
        500,
      );

    return () =>
      clearTimeout(
        timer,
      );
  }, [
    pagina,
    revista?.id,
    user?.id,
  ]);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    const anterior =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        anterior;
    };
  }, [
    fullscreen,
  ]);

  function irPara(
    proxima,
  ) {
    setPagina(
      limitar(
        Number(
          proxima,
        ),
        1,
        total,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  function iniciarSwipe(
    event,
  ) {
    swipeRef.current = {
      x:
        event.clientX,
      y:
        event.clientY,
    };
  }

  function finalizarSwipe(
    event,
  ) {
    const inicio =
      swipeRef.current;

    swipeRef.current =
      null;

    if (!inicio) {
      return;
    }

    const dx =
      event.clientX -
      inicio.x;

    const dy =
      event.clientY -
      inicio.y;

    if (
      Math.abs(
        dx,
      ) < 55 ||
      Math.abs(
        dx,
      ) <
        Math.abs(
          dy,
        ) *
          1.25
    ) {
      return;
    }

    if (dx < 0) {
      irPara(
        pagina + 1,
      );
    } else {
      irPara(
        pagina - 1,
      );
    }
  }

  if (carregando) {
    return (
      <div className="loading-page">
        <div className="loading-dot" />

        <p>
          Abrindo a revista…
        </p>
      </div>
    );
  }

  if (
    erro ||
    !revista ||
    !pdf
  ) {
    return (
      <div className="app">
        <main className="page-content revista-error-page">
          <div className="library-message">
            {erro ||
              "Revista não encontrada."}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              navigate(
                "/ebd",
              )
            }
          >
            <ArrowLeft
              size={18}
            />
            Voltar para EBD
          </button>
        </main>
      </div>
    );
  }

  return (
    <div
      className={
        fullscreen
          ? "revista-reader revista-reader-fullscreen"
          : "revista-reader"
      }
    >
      <header className="revista-toolbar">
        <button
          type="button"
          className="book-icon-button"
          onClick={() =>
            navigate(
              `/trimestres/${revista.trimestre_id}`,
            )
          }
          aria-label="Voltar ao trimestre"
        >
          <ArrowLeft
            size={20}
          />
        </button>

        <div className="revista-toolbar-title">
          <span>
            Revista
          </span>

          <strong>
            {revista.titulo}
          </strong>
        </div>

        <div className="revista-toolbar-hint">
          <BookOpenCheck
            size={16}
          />

          <span>
            Referências clicáveis · selecione uma palavra
          </span>
        </div>

        <button
          type="button"
          className="book-icon-button"
          onClick={() =>
            setFullscreen(
              (atual) =>
                !atual,
            )
          }
          aria-label={
            fullscreen
              ? "Sair da tela cheia"
              : "Tela cheia"
          }
        >
          {fullscreen
            ? (
              <Minimize2
                size={19}
              />
            )
            : (
              <Maximize2
                size={19}
              />
            )}
        </button>
      </header>

      <div className="revista-progress-track">
        <div
          className="revista-progress-value"
          style={{
            width:
              `${percentual}%`,
          }}
        />
      </div>

      <main
        className="revista-reader-main"
        onPointerDown={
          iniciarSwipe
        }
        onPointerUp={
          finalizarSwipe
        }
      >
        <RevistaPagina
          pdf={pdf}
          numero={pagina}
          onReferencia={
            setReferenciaAtiva
          }
          onPalavra={
            setPalavraDicionario
          }
        />
      </main>

      <footer className="revista-navigation">
        <button
          type="button"
          className="book-icon-button"
          disabled={
            pagina <= 1
          }
          onClick={() =>
            irPara(
              pagina -
                1,
            )
          }
          aria-label="Página anterior"
        >
          <ChevronLeft
            size={21}
          />
        </button>

        <button
          type="button"
          className="revista-page-counter"
          aria-label="Página atual"
          onClick={() => {
            const valor =
              window.prompt(
                `Ir para a página (1 a ${total})`,
                String(
                  pagina,
                ),
              );

            if (valor) {
              irPara(
                Number(
                  valor,
                ),
              );
            }
          }}
        >
          {pagina} / {total}
        </button>

        <button
          type="button"
          className="book-icon-button"
          disabled={
            pagina >= total
          }
          onClick={() =>
            irPara(
              pagina +
                1,
            )
          }
          aria-label="Próxima página"
        >
          <ChevronRight
            size={21}
          />
        </button>
      </footer>

      <DictionarySelectionAction
        containerSelector=".revista-interactive-page"
        onOpen={
          setPalavraDicionario
        }
      />

      <BiblePassageModal
        referencia={
          referenciaAtiva
        }
        onClose={() =>
          setReferenciaAtiva(
            null,
          )
        }
      />

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
}

export default RevistaEbdPage;
