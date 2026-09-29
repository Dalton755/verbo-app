import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  LibraryBig,
  MessageSquareText,
  Mic2,
  NotebookPen,
  Sparkles,
  Timer,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useAuth,
} from "../contexts/AuthContext";

const DEMOS = {
  sermoes: {
    titulo: "Pregação",
    icone: Mic2,
    rota: "/sermoes",
    cta: "Usar meu sermão agora",
  },
  ebd: {
    titulo: "EBD",
    icone: BookOpen,
    rota: "/ebd",
    cta: "Preparar minha aula agora",
  },
  livros: {
    titulo: "Livros",
    icone: LibraryBig,
    rota: "/livros",
    cta: "Adicionar meu livro agora",
  },
};

function ActivationDemoPage() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const tipoSeguro =
    DEMOS[tipo]
      ? tipo
      : "sermoes";

  const demo =
    DEMOS[tipoSeguro];

  const [modoSermao, setModoSermao] =
    useState("preparar");

  const [versoAberto, setVersoAberto] =
    useState(false);

  const [slideAtual, setSlideAtual] =
    useState(0);

  const [destaqueLivro, setDestaqueLivro] =
    useState(false);

  const [notaLivro, setNotaLivro] =
    useState(false);

  const Icone = demo.icone;

  const passos = useMemo(() => {
    if (tipoSeguro === "sermoes") {
      return [
        "Alterne entre Preparar e Pregar",
        "Abra a referência sem sair do sermão",
        "Leve seu próprio esboço para o mesmo fluxo",
      ];
    }

    if (tipoSeguro === "ebd") {
      return [
        "Avance como em uma apresentação real",
        "Abra a referência da aula no mesmo contexto",
        "Depois importe sua própria aula",
      ];
    }

    return [
      "Marque um trecho importante",
      "Registre uma nota ligada à leitura",
      "Depois use o mesmo fluxo no seu PDF",
    ];
  }, [tipoSeguro]);

  function trocarDemo(novoTipo) {
    navigate(
      `/experiencia/${novoTipo}`,
      {
        replace: true,
      },
    );

    setVersoAberto(false);
  }

  function usarMeuMaterial() {
    if (user?.id) {
      try {
        localStorage.setItem(
          `verbo-tour:v2:${user.id}:${tipoSeguro}`,
          "1",
        );
      } catch {
        // Não bloqueia a ação principal.
      }
    }

    navigate(demo.rota, {
      state: {
        abrirPrimeiraAcao: true,
        origemDemonstracao: true,
      },
    });
  }

  return (
    <div className="activation-demo-page">
      <header className="activation-demo-topbar">
        <button
          type="button"
          className="activation-demo-back"
          onClick={() =>
            navigate("/")
          }
        >
          <ArrowLeft size={18} />
          Biblioteca
        </button>

        <div className="activation-demo-progress-label">
          <Sparkles size={16} />
          Experimente antes de importar
        </div>
      </header>

      <main className="activation-demo-content">
        <section className="activation-demo-intro">
          <div className="activation-demo-icon">
            <Icone size={26} />
          </div>

          <div>
            <span>
              DEMONSTRAÇÃO INTERATIVA · CERCA DE 1 MINUTO
            </span>

            <h1>
              Veja o VERBO funcionando antes de usar seu arquivo.
            </h1>

            <p>
              Toque nos controles abaixo. A ideia é você perceber o ganho primeiro e só depois decidir importar seu próprio material.
            </p>
          </div>
        </section>

        <div className="activation-demo-tabs">
          {Object.entries(DEMOS).map(
            ([
              chave,
              item,
            ]) => {
              const AbaIcone =
                item.icone;

              return (
                <button
                  key={chave}
                  type="button"
                  className={
                    chave === tipoSeguro
                      ? "activation-demo-tab activation-demo-tab-active"
                      : "activation-demo-tab"
                  }
                  onClick={() =>
                    trocarDemo(chave)
                  }
                >
                  <AbaIcone
                    size={17}
                  />
                  {item.titulo}
                </button>
              );
            },
          )}
        </div>

        <section className="activation-demo-stage">
          <div className="activation-demo-stage-heading">
            <div>
              <span>
                APRENDA FAZENDO
              </span>

              <h2>
                {tipoSeguro === "sermoes"
                  ? "Sermão: Permanecer em Cristo"
                  : tipoSeguro === "ebd"
                    ? "Aula: O princípio da obediência"
                    : "Livro: Fundamentos da vida cristã"}
              </h2>
            </div>

            <strong>
              Exemplo
            </strong>
          </div>

          {tipoSeguro === "sermoes" && (
            <div className="activation-sermon-demo">
              <div className="activation-sermon-modes">
                <button
                  type="button"
                  className={
                    modoSermao ===
                    "preparar"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setModoSermao(
                      "preparar",
                    )
                  }
                >
                  <NotebookPen
                    size={17}
                  />
                  Preparar
                </button>

                <button
                  type="button"
                  className={
                    modoSermao ===
                    "pregar"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setModoSermao(
                      "pregar",
                    )
                  }
                >
                  <Mic2 size={17} />
                  Pregar
                </button>
              </div>

              <div
                className={
                  modoSermao ===
                  "pregar"
                    ? "activation-sermon-reader activation-sermon-reader-pulpit"
                    : "activation-sermon-reader"
                }
              >
                {modoSermao ===
                  "pregar" && (
                    <div className="activation-pulpit-status">
                      <Timer size={16} />
                      Modo Pregação · 00:00
                    </div>
                  )}

                <span>
                  João 15
                </span>

                <h3>
                  Permanecer é mais do que visitar
                </h3>

                <p>
                  Jesus não chamou seus discípulos apenas para momentos de proximidade, mas para uma vida de permanência. Fruto é consequência de conexão.
                </p>

                <button
                  type="button"
                  className="activation-bible-reference"
                  onClick={() =>
                    setVersoAberto(
                      (atual) =>
                        !atual,
                    )
                  }
                >
                  João 15:5
                </button>

                {versoAberto && (
                  <div className="activation-reference-panel">
                    <strong>
                      Referência aberta sem sair do sermão
                    </strong>

                    <p>
                      “Eu sou a videira; vocês são os ramos...” 
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tipoSeguro === "ebd" && (
            <div className="activation-ebd-demo">
              <div className="activation-slide-shell">
                <div className="activation-slide-counter">
                  Slide{" "}
                  {slideAtual + 1} de 2
                </div>

                {slideAtual === 0 ? (
                  <div className="activation-slide-card">
                    <span>
                      PRINCÍPIO
                    </span>

                    <h3>
                      A obediência protege aquilo que Deus estabeleceu.
                    </h3>

                    <p>
                      A primeira ordem dada no Éden também revelou limites, responsabilidade e confiança.
                    </p>

                    <button
                      type="button"
                      className="activation-bible-reference"
                      onClick={() =>
                        setVersoAberto(
                          (atual) =>
                            !atual,
                        )
                      }
                    >
                      Gênesis 2:16–17
                    </button>
                  </div>
                ) : (
                  <div className="activation-slide-card">
                    <span>
                      APLICAÇÃO
                    </span>

                    <h3>
                      Obedecer não é perder liberdade; é aprender a viver dentro do propósito.
                    </h3>

                    <p>
                      O professor consegue manter o foco na aula e consultar o texto bíblico sem trocar de aplicativo.
                    </p>
                  </div>
                )}

                {versoAberto && (
                  <div className="activation-reference-panel">
                    <strong>
                      Referência disponível durante a apresentação
                    </strong>

                    <p>
                      O texto bíblico pode ser consultado no mesmo contexto da aula.
                    </p>
                  </div>
                )}

                <div className="activation-slide-controls">
                  <button
                    type="button"
                    disabled={
                      slideAtual === 0
                    }
                    onClick={() =>
                      setSlideAtual(0)
                    }
                  >
                    <ChevronLeft
                      size={18}
                    />
                  </button>

                  <button
                    type="button"
                    disabled={
                      slideAtual === 1
                    }
                    onClick={() =>
                      setSlideAtual(1)
                    }
                  >
                    <ChevronRight
                      size={18}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {tipoSeguro === "livros" && (
            <div className="activation-book-demo">
              <div className="activation-book-toolbar">
                <button
                  type="button"
                  className={
                    destaqueLivro
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setDestaqueLivro(
                      (atual) =>
                        !atual,
                    )
                  }
                >
                  <Highlighter
                    size={17}
                  />
                  Destacar
                </button>

                <button
                  type="button"
                  className={
                    notaLivro
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setNotaLivro(
                      (atual) =>
                        !atual,
                    )
                  }
                >
                  <MessageSquareText
                    size={17}
                  />
                  Nota
                </button>
              </div>

              <article className="activation-book-reader">
                <span>
                  Capítulo 1
                </span>

                <h3>
                  Uma fé que também pensa
                </h3>

                <p>
                  A leitura cristã não serve apenas para acumular informações. Ela deve nos conduzir à compreensão, reflexão e prática.
                </p>

                <p
                  className={
                    destaqueLivro
                      ? "activation-book-highlight"
                      : ""
                  }
                >
                  Conhecimento se torna mais útil quando conseguimos voltar ao ponto importante, registrar o que aprendemos e relacionar a leitura com as Escrituras.
                </p>

                {notaLivro && (
                  <aside className="activation-book-note">
                    <NotebookPen
                      size={17}
                    />
                    <div>
                      <strong>
                        Minha nota
                      </strong>
                      <span>
                        Aplicar este ponto na próxima aula.
                      </span>
                    </div>
                  </aside>
                )}
              </article>
            </div>
          )}
        </section>

        <section className="activation-demo-learned">
          <div>
            <span>
              O QUE VOCÊ ACABOU DE VER
            </span>

            <h2>
              Agora faz sentido usar um material seu.
            </h2>
          </div>

          <div className="activation-demo-checks">
            {passos.map(
              (passo) => (
                <div key={passo}>
                  <CheckCircle2
                    size={18}
                  />
                  <span>
                    {passo}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>

        <div className="activation-demo-final">
          <button
            type="button"
            className="primary-button activation-demo-cta"
            onClick={
              usarMeuMaterial
            }
          >
            {demo.cta}
            <ChevronRight
              size={18}
            />
          </button>

          <p>
            O próximo passo já abre a ação certa. Você não precisa procurar onde começar.
          </p>
        </div>
      </main>
    </div>
  );
}

export default ActivationDemoPage;
