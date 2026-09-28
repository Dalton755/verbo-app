import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BookOpen,
} from "lucide-react";

import * as pdfjsLib
  from "pdfjs-dist";

import pdfWorker
  from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { supabase } from "../lib/supabase";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

function EbdMaterialCover({
  storagePath,
  alt = "Capa do material",
}) {
  const canvasRef =
    useRef(null);

  const [
    carregando,
    setCarregando,
  ] = useState(
    Boolean(storagePath),
  );

  const [
    falhou,
    setFalhou,
  ] = useState(false);

  useEffect(() => {
    if (!storagePath) {
      setCarregando(false);
      setFalhou(true);
      return;
    }

    let ativo = true;
    let documento = null;
    let renderTask = null;

    async function carregarCapa() {
      setCarregando(true);
      setFalhou(false);

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            "biblia-slides-pdfs",
          )
          .createSignedUrl(
            storagePath,
            60 * 60,
          );

      if (
        error ||
        !data?.signedUrl
      ) {
        throw (
          error ||
          new Error(
            "Não foi possível acessar o PDF.",
          )
        );
      }

      documento =
        await pdfjsLib
          .getDocument({
            url:
              data.signedUrl,

            disableAutoFetch:
              true,

            disableStream:
              false,
          })
          .promise;

      if (!ativo) {
        await documento
          ?.destroy?.();

        return;
      }

      const pagina =
        await documento
          .getPage(1);

      const viewportBase =
        pagina.getViewport({
          scale: 1,
        });

      const largura =
        420;

      const escala =
        largura /
        viewportBase.width;

      const viewport =
        pagina.getViewport({
          scale:
            escala,
        });

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

      if (!contexto) {
        throw new Error(
          "Não foi possível preparar a capa.",
        );
      }

      canvas.width =
        Math.ceil(
          viewport.width,
        );

      canvas.height =
        Math.ceil(
          viewport.height,
        );

      contexto.fillStyle =
        "#ffffff";

      contexto.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      renderTask =
        pagina.render({
          canvasContext:
            contexto,

          viewport,
        });

      await renderTask
        .promise;

      if (!ativo) {
        return;
      }

      setCarregando(false);
    }

    carregarCapa()
      .catch(
        (error) => {
          if (
            error?.name ===
            "RenderingCancelledException"
          ) {
            return;
          }

          console.warn(
            "Não foi possível gerar a capa do material EBD:",
            error,
          );

          if (ativo) {
            setFalhou(true);
            setCarregando(false);
          }
        },
      );

    return () => {
      ativo = false;

      try {
        renderTask?.cancel?.();
      } catch {
        // Render já finalizado.
      }

      documento
        ?.destroy?.()
        .catch?.(
          () => {},
        );
    };
  }, [
    storagePath,
  ]);

  return (
    <div
      className="ebd-cover-preview"
      role="img"
      aria-label={alt}
    >
      <canvas
        ref={canvasRef}
        className={
          falhou
            ? "ebd-cover-canvas ebd-cover-canvas-hidden"
            : "ebd-cover-canvas"
        }
      />

      {carregando && (
        <div className="ebd-cover-placeholder">
          <div className="loading-dot" />

          <span>
            Preparando capa…
          </span>
        </div>
      )}

      {!carregando &&
        falhou && (
          <div className="ebd-cover-placeholder">
            <BookOpen
              size={28}
              strokeWidth={1.7}
            />

            <span>
              Capa indisponível
            </span>
          </div>
        )}
    </div>
  );
}

export default EbdMaterialCover;
