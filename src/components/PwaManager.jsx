import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Download,
  RefreshCw,
  X,
} from "lucide-react";

function estaEmModoApp() {
  return (
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches ||
    window.navigator.standalone === true
  );
}

function obterBuildAtual() {
  const scripts = Array.from(
    document.querySelectorAll(
      'script[src*="/assets/"]',
    ),
  );

  const principal =
    scripts.find((script) =>
      script.src.includes(".js"),
    );

  if (!principal) {
    return null;
  }

  try {
    return new URL(
      principal.src,
      window.location.origin,
    ).pathname;
  } catch {
    return principal.src;
  }
}

function obterBuildDoHtml(html) {
  const correspondencia =
    html.match(
      /<script[^>]+src=["']([^"']*\/assets\/[^"']+\.js)["']/i,
    );

  if (!correspondencia?.[1]) {
    return null;
  }

  try {
    return new URL(
      correspondencia[1],
      window.location.origin,
    ).pathname;
  } catch {
    return correspondencia[1];
  }
}

function PwaManager() {
  const [
    promptInstalacao,
    setPromptInstalacao,
  ] = useState(null);

  const [
    instalando,
    setInstalando,
  ] = useState(false);

  const [
    novaVersao,
    setNovaVersao,
  ] = useState(null);

  const [
    atualizando,
    setAtualizando,
  ] = useState(false);

  const buildAtualRef =
    useRef(null);

  const versaoIgnoradaRef =
    useRef(null);

  useEffect(() => {
    function aoPoderInstalar(event) {
      event.preventDefault();

      if (estaEmModoApp()) {
        return;
      }

      setPromptInstalacao(event);
    }

    function aoInstalar() {
      setPromptInstalacao(null);
    }

    window.addEventListener(
      "beforeinstallprompt",
      aoPoderInstalar,
    );

    window.addEventListener(
      "appinstalled",
      aoInstalar,
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        aoPoderInstalar,
      );

      window.removeEventListener(
        "appinstalled",
        aoInstalar,
      );
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

    buildAtualRef.current =
      obterBuildAtual();

    let ativo = true;

    async function verificarAtualizacao() {
      if (!ativo) {
        return;
      }

      try {
        const resposta =
          await fetch(
            `/?__verbo_check=${Date.now()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control":
                  "no-cache",
              },
            },
          );

        if (!resposta.ok) {
          return;
        }

        const html =
          await resposta.text();

        const buildRemoto =
          obterBuildDoHtml(html);

        const buildAtual =
          buildAtualRef.current;

        if (
          !buildAtual ||
          !buildRemoto ||
          buildAtual === buildRemoto
        ) {
          return;
        }

        if (
          versaoIgnoradaRef.current ===
          buildRemoto
        ) {
          return;
        }

        setNovaVersao(buildRemoto);
      } catch (error) {
        console.debug(
          "Não foi possível verificar atualização:",
          error,
        );
      }
    }

    const intervalo =
      window.setInterval(
        verificarAtualizacao,
        60000,
      );

    function aoFicarVisivel() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        verificarAtualizacao();
      }
    }

    function aoReceberFoco() {
      verificarAtualizacao();
    }

    document.addEventListener(
      "visibilitychange",
      aoFicarVisivel,
    );

    window.addEventListener(
      "focus",
      aoReceberFoco,
    );

    verificarAtualizacao();

    return () => {
      ativo = false;

      window.clearInterval(
        intervalo,
      );

      document.removeEventListener(
        "visibilitychange",
        aoFicarVisivel,
      );

      window.removeEventListener(
        "focus",
        aoReceberFoco,
      );
    };
  }, []);

  async function instalarApp() {
    if (!promptInstalacao) {
      return;
    }

    try {
      setInstalando(true);

      await promptInstalacao.prompt();

      const escolha =
        await promptInstalacao.userChoice;

      if (
        escolha.outcome ===
        "accepted"
      ) {
        setPromptInstalacao(null);
      }
    } finally {
      setInstalando(false);
    }
  }

  async function atualizarApp() {
    setAtualizando(true);

    try {
      if (
        "serviceWorker" in navigator
      ) {
        const registro =
          await navigator
            .serviceWorker
            .getRegistration();

        if (registro) {
          await registro.update();
        }
      }
    } catch (error) {
      console.debug(
        "Atualização do Service Worker:",
        error,
      );
    }

    window.location.reload();
  }

  function adiarAtualizacao() {
    versaoIgnoradaRef.current =
      novaVersao;

    setNovaVersao(null);
  }

  const mostrarInstalacao =
    Boolean(promptInstalacao) &&
    !estaEmModoApp();

  return (
    <>
      {mostrarInstalacao && (
        <aside
          className="pwa-install-banner"
          aria-label="Instalar VERBO"
        >
          <div className="pwa-install-icon">
            <Download size={20} />
          </div>

          <div className="pwa-install-copy">
            <strong>
              Instale o VERBO
            </strong>

            <span>
              Abra como um aplicativo,
              sem a barra do navegador.
            </span>
          </div>

          <button
            type="button"
            className="pwa-install-button"
            onClick={instalarApp}
            disabled={instalando}
          >
            {instalando
              ? "Abrindo..."
              : "Instalar"}
          </button>

          <button
            type="button"
            className="pwa-install-close"
            aria-label="Fechar"
            onClick={() =>
              setPromptInstalacao(null)
            }
          >
            <X size={18} />
          </button>
        </aside>
      )}

      {novaVersao && (
        <div
          className="pwa-update-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-update-title"
        >
          <article className="pwa-update-modal">
            <div className="pwa-update-symbol">
              <RefreshCw size={25} />
            </div>

            <div className="pwa-update-text">
              <span>
                VERBO atualizado
              </span>

              <h2 id="pwa-update-title">
                Nova versão disponível
              </h2>

              <p>
                Publicamos melhorias no
                VERBO. Atualize agora para
                usar a versão mais recente.
              </p>
            </div>

            <div className="pwa-update-actions">
              <button
                type="button"
                className="pwa-update-later"
                onClick={
                  adiarAtualizacao
                }
                disabled={atualizando}
              >
                Agora não
              </button>

              <button
                type="button"
                className="pwa-update-now"
                onClick={
                  atualizarApp
                }
                disabled={atualizando}
              >
                <RefreshCw
                  size={17}
                  className={
                    atualizando
                      ? "pwa-spin"
                      : ""
                  }
                />

                {atualizando
                  ? "Atualizando..."
                  : "Atualizar"}
              </button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

export default PwaManager;