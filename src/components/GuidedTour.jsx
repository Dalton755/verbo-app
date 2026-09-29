import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "../contexts/AuthContext";

const VERSAO_TOUR = "v2";

const TOURS = [
  {
    id: "biblioteca",
    corresponde: (caminho) =>
      caminho === "/",
    titulo: "Sua Biblioteca VERBO",
    passos: [
      {
        titulo: "Veja o valor antes de configurar qualquer coisa",
        texto:
          "Em cerca de 1 minuto você vai entender onde o VERBO ajuda de verdade. Depois você escolhe um objetivo e usa seu próprio material.",
      },
      {
        seletor: ".module-grid",
        titulo: "Comece pelo que você precisa fazer",
        texto:
          "EBD, Sermões e Livros não são só pastas. Cada módulo muda a experiência para a tarefa: ensinar, pregar ou estudar.",
      },
      {
        seletor: ".library-tip",
        titulo: "O diferencial aparece dentro do conteúdo",
        texto:
          "O VERBO reconhece referências bíblicas nos materiais para que a Bíblia continue acessível durante leitura, estudo, aula e pregação.",
      },
      {
        seletor: ".storage-card",
        titulo: "Seu material continua sendo seu",
        texto:
          "Aqui você acompanha o espaço usado. Agora escolha um módulo e experimente o fluxo com aquilo que você realmente faz.",
      },
    ],
  },
  {
    id: "ebd",
    corresponde: (caminho) =>
      caminho === "/ebd",
    titulo: "Preparar uma aula de EBD",
    passos: [
      {
        titulo: "Do trimestre à apresentação, sem bagunça",
        texto:
          "Você vai aprender o fluxo essencial: organizar o trimestre, adicionar a aula e apresentar com apoio bíblico sem quebrar sua concentração.",
      },
      {
        seletor:
          ".trimestres-grid, .empty-state",
        titulo: "Tudo começa no trimestre",
        texto:
          "O trimestre reúne o período, o tema e as aulas. Isso evita arquivos soltos e deixa a sequência de ensino clara.",
      },
      {
        seletor:
          ".mobile-action .primary-button, .section-heading .secondary-button, .empty-state .primary-button",
        titulo: "Crie a estrutura uma vez",
        texto:
          "Depois do trimestre criado, você entra nele e adiciona as aulas conforme precisar. O próximo passo já abre essa ação para você.",
      },
    ],
  },
  {
    id: "trimestre",
    corresponde: (caminho) =>
      /^\/trimestres\/[^/]+\/?$/.test(
        caminho,
      ),
    titulo: "Aulas do trimestre",
    passos: [
      {
        titulo: "Dentro do trimestre",
        texto:
          "Aqui você organiza as aulas daquele período. Cada aula pode receber um PDF e depois ser aberta no modo de apresentação.",
      },
      {
        seletor: ".trimestre-hero",
        titulo: "Identificação do trimestre",
        texto:
          "Esta área resume o período e o tema para você saber exatamente em qual trimestre está trabalhando.",
      },
      {
        seletor:
          ".aulas-list, .trimestre-empty-state",
        titulo: "Lista de aulas",
        texto:
          "As aulas aparecem em sequência. Toque em uma aula para abrir a apresentação correspondente.",
      },
      {
        seletor:
          ".mobile-action .primary-button, .desktop-import-button, .trimestre-empty-state .primary-button",
        titulo: "Importar aula",
        texto:
          "Use este botão para adicionar uma aula em PDF ou PPTX. O VERBO prepara o arquivo para apresentação e recursos bíblicos.",
      },
      {
        seletor: ".aula-card-main",
        titulo: "Abrir apresentação",
        texto:
          "Toque no corpo do cartão da aula para entrar no modo de apresentação.",
      },
      {
        seletor:
          ".aula-menu-area .book-theme-menu-button",
        titulo: "Opções da aula",
        texto:
          "No menu de três pontos você encontra ações de gerenciamento da aula, como editar ou excluir.",
      },
    ],
  },
  {
    id: "apresentacao",
    corresponde: (caminho) =>
      /^\/aulas\/[^/]+\/apresentar\/?$/.test(
        caminho,
      ),
    titulo: "Apresentação da aula",
    passos: [
      {
        titulo: "Apresente com apoio do VERBO",
        texto:
          "Este modo foi feito para usar durante a aula. Você navega pelos slides e abre referências bíblicas sem precisar sair da apresentação.",
      },
      {
        seletor: ".presentation-header",
        titulo: "Barra da apresentação",
        texto:
          "Aqui ficam o retorno ao trimestre, a identificação da aula e as principais ações da apresentação.",
      },
      {
        seletor:
          ".presentation-bible-button",
        titulo: "Referências da página",
        texto:
          "Quando o slide atual possui referências detectadas, este botão reúne todas elas para acesso rápido.",
      },
      {
        seletor:
          ".bible-reference-hotspot",
        titulo: "Referências clicáveis",
        texto:
          "Quando uma referência aparece destacada no slide, toque nela para abrir o texto bíblico em um painel sobre a apresentação.",
      },
      {
        seletor:
          ".presentation-fullscreen",
        titulo: "Tela cheia",
        texto:
          "Use a tela cheia para aproveitar melhor o espaço, especialmente ao projetar ou ensinar pelo celular.",
      },
      {
        seletor: ".presentation-stage",
        titulo: "Área do slide",
        texto:
          "Esta é a área principal da apresentação. No celular você também pode deslizar horizontalmente para avançar ou voltar.",
      },
      {
        seletor:
          ".presentation-side-right",
        titulo: "Navegação",
        texto:
          "As laterais avançam e voltam os slides. Os controles inferiores oferecem a mesma navegação e mostram a página atual.",
      },
      {
        seletor: ".presentation-footer",
        titulo: "Progresso da apresentação",
        texto:
          "Aqui você acompanha em qual slide está e quantos ainda fazem parte do arquivo.",
      },
    ],
  },
  {
    id: "sermoes",
    corresponde: (caminho) =>
      caminho === "/sermoes",
    titulo: "Preparar uma pregação",
    passos: [
      {
        titulo: "Seu esboço não precisa continuar sendo só um PDF",
        texto:
          "Em menos de 1 minuto você vai entender como o VERBO transforma o material em uma experiência de preparo e em uma tela própria para o púlpito.",
      },
      {
        seletor: ".sermons-heading",
        titulo: "O objetivo é chegar pronto ao púlpito",
        texto:
          "Você importa o esboço que já usa. Depois o VERBO organiza a continuidade do preparo e separa a experiência de Preparar da experiência de Pregar.",
      },
      {
        seletor:
          ".sermons-list, .module-empty",
        titulo: "Aqui ficam as mensagens que você pode continuar",
        texto:
          "Depois da primeira importação, seus sermões ficam acessíveis para revisar, marcar, anotar e abrir novamente quando precisar.",
      },
      {
        seletor:
          ".desktop-import-button, .sermon-first-button, .mobile-action .primary-button",
        titulo: "Agora use um material seu",
        texto:
          "Importe o esboço que você já tem em PDF ou DOCX. O próximo toque já abre a importação, sem exigir configuração extra.",
      },
    ],
  },
  {
    id: "sermao",
    corresponde: (caminho) =>
      /^\/sermoes\/[^/]+\/?$/.test(
        caminho,
      ),
    titulo: "Recursos do sermão",
    passos: [
      {
        titulo: "Prepare e pregue no mesmo arquivo",
        texto:
          "O leitor de sermões possui dois contextos: Preparar, para estudo e ajustes; e Pregar, para uso no púlpito com ferramentas próprias.",
      },
      {
        seletor: ".sermon-toolbar",
        titulo: "Barra do sermão",
        texto:
          "Aqui você volta à lista, vê o título do sermão e alterna entre Preparar e Pregar.",
      },
      {
        seletor:
          ".sermon-toolbar-actions",
        titulo: "Preparar ou Pregar",
        texto:
          "Use Preparar para revisar o material. Ao escolher Pregar, o VERBO ativa cronômetro, modo púlpito e controles pensados para a ministração.",
      },
      {
        seletor:
          ".sermon-context-toolbar",
        titulo: "Ferramentas de preparação",
        texto:
          "Nesta barra você pode alternar Texto/PDF, ajustar a leitura, criar e consultar marcadores, abrir notas, histórico, registrar pregações, usar tela cheia e editar o sermão.",
      },
      {
        seletor:
          '.sermon-toolbar-actions .sermon-mode-button:nth-child(2)',
        titulo: "Modo Pregação",
        texto:
          "Toque em Pregar quando for ministrar. O cronômetro registra o tempo, o modo púlpito simplifica a tela e você continua tendo acesso aos marcadores.",
      },
      {
        seletor:
          ".sermon-content, .sermon-pdf-original",
        titulo: "Conteúdo do sermão",
        texto:
          "Leia o texto preparado ou consulte o PDF original. O VERBO mantém sua posição para facilitar a continuidade.",
      },
      {
        seletor: ".sermon-progress",
        titulo: "Seu progresso",
        texto:
          "A barra indica quanto do sermão já foi percorrido.",
      },
      {
        titulo: "Dica de uso",
        texto:
          "No modo de preparação, use Editar para ajustar o texto e destacar trechos. Marcadores, notas e histórico ficam associados ao sermão para consulta futura.",
      },
    ],
  },
  {
    id: "livros",
    corresponde: (caminho) =>
      caminho === "/livros",
    titulo: "Estudar um livro",
    passos: [
      {
        titulo: "Seu PDF pode virar uma experiência de estudo",
        texto:
          "Em cerca de 1 minuto você vai entender como o VERBO deixa a leitura mais útil no celular, sem perder o arquivo original.",
      },
      {
        seletor:
          ".books-themes-grid, .sermons-list, .module-empty",
        titulo: "Uma estante que continua de onde você parou",
        texto:
          "Seus livros podem ser organizados e reabertos para continuar a leitura, consultar notas, marcadores e destaques.",
      },
      {
        seletor:
          ".desktop-import-button, .sermon-first-button, .mobile-action .primary-button",
        titulo: "Teste com um livro que você já possui",
        texto:
          "Importe um PDF. O VERBO tenta identificar título e autor e prepara o conteúdo para uma leitura mais prática.",
      },
    ],
  },
  {
    id: "livro",
    corresponde: (caminho) =>
      /^\/livros\/[^/]+\/?$/.test(
        caminho,
      ),
    titulo: "Recursos do leitor",
    passos: [
      {
        titulo: "Leitor de Livros",
        texto:
          "O leitor adapta seu PDF para estudo confortável e mantém o arquivo original disponível quando você precisar conferir a diagramação.",
      },
      {
        seletor: ".book-toolbar",
        titulo: "Barra do leitor",
        texto:
          "A barra superior concentra todos os controles do livro e mostra qual obra está aberta.",
      },
      {
        seletor: ".book-view-toggle",
        titulo: "Texto ou PDF",
        texto:
          "Texto oferece leitura adaptada e recursos interativos. PDF mostra o arquivo original preservando a página como foi enviada.",
      },
      {
        seletor:
          ".book-reading-mode-toggle",
        titulo: "Rolagem ou páginas",
        texto:
          "No modo Texto, escolha rolagem vertical ou leitura por páginas. O VERBO preserva seu progresso entre os modos.",
      },
      {
        seletor: ".book-spread-toggle",
        titulo: "Uma ou duas páginas",
        texto:
          "Em telas maiores, o modo por páginas pode exibir uma ou duas páginas lado a lado.",
      },
      {
        seletor:
          '.book-icon-button[aria-label="Índice do livro"]',
        titulo: "Índice",
        texto:
          "Abra o índice detectado no conteúdo para navegar rapidamente entre partes do livro.",
      },
      {
        seletor:
          '.book-icon-button[aria-label="Buscar no livro"]',
        titulo: "Busca",
        texto:
          "Pesquise uma palavra ou expressão dentro do livro e vá direto aos resultados.",
      },
      {
        seletor:
          ".book-notes-button",
        titulo: "Notas",
        texto:
          "Consulte as anotações salvas no livro e volte ao trecho correspondente quando quiser.",
      },
      {
        seletor:
          '.book-icon-button[title="Marcadores"]',
        titulo: "Marcadores",
        texto:
          "Salve pontos importantes da leitura e retorne a eles com um toque.",
      },
      {
        seletor:
          '.book-icon-button[title="Tema"]',
        titulo: "Tema de leitura",
        texto:
          "Alterne a aparência da leitura para deixar a tela mais confortável no ambiente em que estiver.",
      },
      {
        seletor: ".book-progress",
        titulo: "Progresso de leitura",
        texto:
          "A barra acompanha o avanço no livro e o VERBO salva sua posição para continuar depois.",
      },
      {
        seletor:
          ".book-content, .book-paged-content, .book-pdf-original",
        titulo: "Área de leitura",
        texto:
          "No texto adaptado, referências bíblicas podem ser abertas dentro do leitor. Você também pode selecionar trechos para destacar e criar notas.",
      },
      {
        titulo: "Destaques e notas no texto",
        texto:
          "Selecione um trecho no modo Texto para abrir as opções de destaque e anotação. Suas marcações ficam salvas junto ao livro.",
      },
    ],
  },
  {
    id: "modulos",
    corresponde: (caminho) =>
      caminho ===
      "/configuracoes/modulos",
    titulo: "Personalizar módulos",
    passos: [
      {
        titulo: "Escolha o que aparece no VERBO",
        texto:
          "Aqui você decide quais módulos quer ver na Biblioteca. Isso personaliza a navegação sem apagar nenhum material.",
      },
      {
        seletor: ".topbar",
        titulo: "Configuração de módulos",
        texto:
          "Use o botão voltar quando terminar. As alterações são salvas na sua conta.",
      },
      {
        seletor: ".page-content",
        titulo: "Ative ou desative",
        texto:
          "Cada módulo possui um controle Ativado/Desativado. Ocultar EBD, Sermões ou Livros apenas remove o atalho da Biblioteca; seus arquivos permanecem preservados.",
      },
    ],
  },
];

const ACOES_FINAIS = {
  sermoes: {
    label: "Importar meu primeiro sermão",
    seletor:
      ".sermon-first-button, .desktop-import-button, .mobile-action .primary-button",
  },
  livros: {
    label: "Importar meu primeiro livro",
    seletor:
      ".sermon-first-button, .desktop-import-button, .mobile-action .primary-button",
  },
  ebd: {
    label: "Criar meu primeiro trimestre",
    seletor:
      ".empty-state .primary-button, .section-heading .secondary-button, .mobile-action .primary-button",
  },
};

function obterTour(caminho) {
  return (
    TOURS.find((tour) =>
      tour.corresponde(caminho),
    ) ?? null
  );
}

function GuidedTour() {
  const location = useLocation();
  const { user } = useAuth();

  const tour = useMemo(
    () =>
      obterTour(
        location.pathname,
      ),
    [location.pathname],
  );

  const [
    aberto,
    setAberto,
  ] = useState(false);

  const [
    passoAtual,
    setPassoAtual,
  ] = useState(0);

  const [
    alvoRect,
    setAlvoRect,
  ] = useState(null);

  const passo =
    tour?.passos?.[passoAtual] ??
    null;

  const chaveConclusao =
    user?.id && tour
      ? `verbo-tour:${VERSAO_TOUR}:${user.id}:${tour.id}`
      : null;

  const concluir = useCallback(() => {
    if (chaveConclusao) {
      try {
        localStorage.setItem(
          chaveConclusao,
          "1",
        );
      } catch {
        // O tour continua funcionando
        // mesmo sem armazenamento local.
      }
    }

    setAberto(false);
    setPassoAtual(0);
    setAlvoRect(null);
  }, [chaveConclusao]);

  const abrirTour = useCallback(() => {
    if (!tour) return;

    setPassoAtual(0);
    setAberto(true);
  }, [tour]);

  useEffect(() => {
    setAberto(false);
    setPassoAtual(0);
    setAlvoRect(null);

    if (
      !user?.id ||
      !tour ||
      !chaveConclusao
    ) {
      return;
    }

    let concluido = false;

    try {
      concluido =
        localStorage.getItem(
          chaveConclusao,
        ) === "1";
    } catch {
      concluido = false;
    }

    if (concluido) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        if (
          document.querySelector(
            ".activation-onboarding-overlay",
          )
        ) {
          return;
        }

        setAberto(true);
      }, 850);

    return () =>
      window.clearTimeout(timer);
  }, [
    user?.id,
    tour,
    chaveConclusao,
  ]);

  useEffect(() => {
    if (!aberto || !passo) {
      setAlvoRect(null);
      return;
    }

    let timer = null;

    function atualizar() {
      if (!passo.seletor) {
        setAlvoRect(null);
        return;
      }

      const elemento =
        document.querySelector(
          passo.seletor,
        );

      if (!elemento) {
        setAlvoRect(null);
        return;
      }

      const rect =
        elemento.getBoundingClientRect();

      const foraDaTela =
        rect.bottom < 70 ||
        rect.top >
          window.innerHeight - 70;

      if (foraDaTela) {
        elemento.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });

        window.clearTimeout(
          timer,
        );

        timer =
          window.setTimeout(
            atualizar,
            320,
          );

        return;
      }

      setAlvoRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    atualizar();

    const atualizarDepois =
      () => atualizar();

    window.addEventListener(
      "resize",
      atualizarDepois,
    );

    window.addEventListener(
      "scroll",
      atualizarDepois,
      true,
    );

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener(
        "resize",
        atualizarDepois,
      );

      window.removeEventListener(
        "scroll",
        atualizarDepois,
        true,
      );
    };
  }, [
    aberto,
    passoAtual,
    passo,
  ]);

  if (!tour || !user?.id) {
    return null;
  }

  const total =
    tour.passos.length;

  const ultimo =
    passoAtual === total - 1;

  const acaoFinal =
    ACOES_FINAIS[tour.id] ??
    null;

  const larguraCard =
    Math.min(
      370,
      Math.max(
        280,
        window.innerWidth - 24,
      ),
    );

  let estiloCard = {
    width: `${larguraCard}px`,
  };

  let posicaoCard =
    "centro";

  if (alvoRect) {
    const alvoCentroX =
      alvoRect.left +
      alvoRect.width / 2;

    const alvoCentroY =
      alvoRect.top +
      alvoRect.height / 2;

    const telaLarga =
      window.innerWidth >= 760;

    const alvoNaoOcupaTelaToda =
      alvoRect.width <
      window.innerWidth * 0.58;

    if (
      telaLarga &&
      alvoNaoOcupaTelaToda
    ) {
      const alvoNaEsquerda =
        alvoCentroX <
        window.innerWidth / 2;

      posicaoCard =
        alvoNaEsquerda
          ? "direita"
          : "esquerda";

      estiloCard = {
        ...estiloCard,
        top: "50%",
        transform:
          "translateY(-50%)",
        left:
          alvoNaEsquerda
            ? `${window.innerWidth - larguraCard - 18}px`
            : "18px",
      };
    } else {
      const alvoNaMetadeSuperior =
        alvoCentroY <
        window.innerHeight / 2;

      posicaoCard =
        alvoNaMetadeSuperior
          ? "baixo"
          : "cima";

      estiloCard = {
        ...estiloCard,
        left: "50%",
        transform:
          "translateX(-50%)",
        ...(alvoNaMetadeSuperior
          ? {
              bottom: "14px",
            }
          : {
              top: "14px",
            }),
      };
    }
  }

  return (
    <>
      {!aberto && (
        <button
          type="button"
          className="guided-tour-help"
          aria-label="Rever tour desta página"
          title="Tour desta página"
          onClick={abrirTour}
        >
          <HelpCircle size={21} />
        </button>
      )}

      {aberto && passo && (
        <div
          className="guided-tour-layer"
          role="dialog"
          aria-modal="true"
          aria-label={
            tour.titulo
          }
        >
          <div className="guided-tour-blocker" />

          {alvoRect && (
            <div
              className="guided-tour-spotlight"
              style={{
                top:
                  alvoRect.top - 6,
                left:
                  alvoRect.left - 6,
                width:
                  alvoRect.width + 12,
                height:
                  alvoRect.height + 12,
              }}
            />
          )}

          <article
            className={
              alvoRect
                ? `guided-tour-card guided-tour-card-${posicaoCard}`
                : "guided-tour-card guided-tour-card-centered"
            }
            style={
              alvoRect
                ? estiloCard
                : {
                    width:
                      `${larguraCard}px`,
                  }
            }
          >
            <div className="guided-tour-card-top">
              <div className="guided-tour-symbol">
                <Sparkles size={18} />
              </div>

              <div>
                <span className="guided-tour-badge">
                  APRENDA FAZENDO
                </span>

                <strong className="guided-tour-section">
                  {tour.titulo}
                </strong>

                <small>
                  Passo {passoAtual + 1} de{" "}
                  {total}
                </small>
              </div>

              {passoAtual >= 2 ? (
                <button
                  type="button"
                  className="guided-tour-close"
                  aria-label="Fechar tutorial"
                  onClick={concluir}
                >
                  <X size={18} />
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>

            <div className="guided-tour-copy">
              <h3>
                {passo.titulo}
              </h3>

              <p>
                {passo.texto}
              </p>

              {passoAtual === 0 && (
                <div className="guided-tour-value-note">
                  Leva cerca de 1 minuto e termina com uma ação prática no seu próprio material.
                </div>
              )}
            </div>

            <div className="guided-tour-progress">
              <div
                style={{
                  width:
                    `${((passoAtual + 1) / total) * 100}%`,
                }}
              />
            </div>

            <div className="guided-tour-actions">
              {passoAtual >= 2 ? (
                <button
                  type="button"
                  className="guided-tour-skip"
                  onClick={concluir}
                >
                  Sair do tutorial
                </button>
              ) : (
                <span
                  className="guided-tour-commitment"
                  aria-hidden="true"
                >
                  Vale 1 minuto
                </span>
              )}

              <div>
                {passoAtual > 0 && (
                  <button
                    type="button"
                    className="guided-tour-back"
                    onClick={() =>
                      setPassoAtual(
                        (atual) =>
                          Math.max(
                            0,
                            atual - 1,
                          ),
                      )
                    }
                  >
                    <ChevronLeft
                      size={16}
                    />
                    Anterior
                  </button>
                )}

                <button
                  type="button"
                  className="guided-tour-next"
                  onClick={() => {
                    if (ultimo) {
                      const seletor =
                        acaoFinal?.seletor;

                      concluir();

                      if (seletor) {
                        window.setTimeout(
                          () => {
                            document
                              .querySelector(
                                seletor,
                              )
                              ?.click();
                          },
                          60,
                        );
                      }

                      return;
                    }

                    setPassoAtual(
                      (atual) =>
                        Math.min(
                          total - 1,
                          atual + 1,
                        ),
                    );
                  }}
                >
                  {ultimo
                    ? acaoFinal?.label ??
                      "Concluir"
                    : passoAtual === 0
                      ? "Mostrar na prática"
                      : "Próximo"}

                  {!ultimo && (
                    <ChevronRight
                      size={16}
                    />
                  )}
                </button>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

export default GuidedTour;
