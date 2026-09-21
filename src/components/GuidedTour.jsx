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

const VERSAO_TOUR = "v1";

const TOURS = [
  {
    id: "biblioteca",
    corresponde: (caminho) =>
      caminho === "/",
    titulo: "Sua Biblioteca VERBO",
    passos: [
      {
        titulo: "Bem-vindo ao VERBO",
        texto:
          "Este tour apresenta o aplicativo sem alterar seus materiais. Ele aparece automaticamente só na primeira visita de cada área e pode ser repetido pelo botão de ajuda.",
      },
      {
        seletor: ".topbar",
        titulo: "Cabeçalho principal",
        texto:
          "Aqui você identifica a área atual, acompanha o período de teste quando aplicável e acessa as ações gerais do aplicativo.",
      },
      {
        seletor:
          '.icon-button[aria-label="Configurar módulos"]',
        titulo: "Personalize seus módulos",
        texto:
          "Use este botão para escolher quais módulos aparecem na Biblioteca. Ocultar um módulo não apaga nenhum conteúdo.",
      },
      {
        seletor: ".module-grid",
        titulo: "Seus módulos",
        texto:
          "EBD organiza trimestres e aulas, Sermões prepara seus esboços para pregação e Livros reúne sua biblioteca de PDFs.",
      },
      {
        seletor: ".storage-card",
        titulo: "Armazenamento",
        texto:
          "Veja quanto espaço está usando, quanto ainda está disponível e gerencie armazenamento adicional quando precisar.",
      },
      {
        seletor: ".library-tip",
        titulo: "Bíblia conectada",
        texto:
          "As referências bíblicas identificadas nos seus materiais podem continuar interativas dentro dos recursos de leitura e apresentação.",
      },
    ],
  },
  {
    id: "ebd",
    corresponde: (caminho) =>
      caminho === "/ebd",
    titulo: "Módulo EBD",
    passos: [
      {
        titulo: "Como funciona a EBD",
        texto:
          "A organização segue um fluxo simples: crie um trimestre, entre nele, importe suas aulas em PDF e abra cada aula para apresentar.",
      },
      {
        seletor: ".module-header",
        titulo: "Navegação da EBD",
        texto:
          "O cabeçalho mostra onde você está e o botão Biblioteca leva de volta à página inicial.",
      },
      {
        seletor: ".search-area",
        titulo: "Busca rápida",
        texto:
          "Use a busca para localizar aulas ou trimestres sem precisar percorrer toda a sua biblioteca.",
      },
      {
        seletor: ".section-heading",
        titulo: "Seus trimestres",
        texto:
          "Os materiais da EBD ficam agrupados por trimestre. Cada trimestre pode ter seu número, ano e tema.",
      },
      {
        seletor:
          ".trimestres-grid, .empty-state",
        titulo: "Abra ou crie um trimestre",
        texto:
          "Toque em um trimestre para ver as aulas. Se ainda não houver nenhum, o próprio VERBO apresenta a opção de criar o primeiro.",
      },
      {
        seletor:
          ".mobile-action .primary-button, .section-heading .secondary-button, .empty-state .primary-button",
        titulo: "Novo trimestre",
        texto:
          "Quando precisar organizar um novo período da EBD, comece por aqui.",
      },
      {
        seletor:
          ".ebd-trimestre-menu-area .book-theme-menu-button",
        titulo: "Gerencie o trimestre",
        texto:
          "O menu de três pontos permite editar os dados do trimestre ou excluí-lo quando necessário.",
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
          "Use este botão para adicionar uma aula em PDF. O VERBO prepara o arquivo para apresentação e recursos bíblicos.",
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
    titulo: "Módulo Sermões",
    passos: [
      {
        titulo: "Sua central de sermões",
        texto:
          "Importe seus esboços em PDF, organize o acervo e abra cada sermão para preparar o conteúdo ou usar o Modo Pregação.",
      },
      {
        seletor: ".sermons-heading",
        titulo: "Visão do módulo",
        texto:
          "Nesta área ficam o título do módulo e as principais ações para começar ou adicionar novos sermões.",
      },
      {
        seletor:
          ".sermon-series-preview",
        titulo: "Séries de sermões",
        texto:
          "Quando você usa séries, elas ajudam a agrupar mensagens relacionadas e a filtrar rapidamente seu acervo.",
      },
      {
        seletor:
          ".sermons-list, .module-empty",
        titulo: "Seus sermões",
        texto:
          "Cada cartão representa um sermão. Toque nele para entrar no leitor e acessar os recursos de preparação e pregação.",
      },
      {
        seletor:
          ".desktop-import-button, .sermon-first-button, .mobile-action .primary-button",
        titulo: "Importar sermão",
        texto:
          "Adicione o PDF que você já utiliza. O VERBO prepara o conteúdo para leitura e para o modo de pregação.",
      },
      {
        seletor: ".sermon-card-main",
        titulo: "Abrir sermão",
        texto:
          "Toque no cartão para abrir o arquivo e continuar preparando ou pregando.",
      },
      {
        seletor:
          ".sermon-item-menu-area .book-theme-menu-button",
        titulo: "Gerencie o sermão",
        texto:
          "O menu de três pontos reúne ações de organização, edição e exclusão do item.",
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
    titulo: "Módulo Livros",
    passos: [
      {
        titulo: "Sua biblioteca pessoal",
        texto:
          "Importe livros em PDF, organize por temas e abra cada obra no leitor do VERBO.",
      },
      {
        seletor: ".sermons-heading",
        titulo: "Visão da estante",
        texto:
          "Aqui ficam o título da área e as ações principais para adicionar ou organizar seus livros.",
      },
      {
        seletor:
          ".books-themes-grid, .sermons-list, .module-empty",
        titulo: "Temas e livros",
        texto:
          "Você pode navegar por temas ou abrir diretamente os livros exibidos na lista atual.",
      },
      {
        seletor:
          ".book-theme-add",
        titulo: "Criar tema",
        texto:
          "Crie categorias como Teologia, Biografias ou Comentários para manter a estante organizada.",
      },
      {
        seletor:
          ".desktop-import-button, .sermon-first-button, .mobile-action .primary-button",
        titulo: "Adicionar livro",
        texto:
          "O fluxo começa pelo PDF. O VERBO tenta identificar título e autor automaticamente e depois permite escolher ou criar o tema sem sair do formulário.",
      },
      {
        seletor: ".book-card-main",
        titulo: "Abrir livro",
        texto:
          "Toque no cartão do livro para entrar no leitor e acessar os recursos de leitura, notas, busca, destaques e marcadores.",
      },
      {
        seletor:
          ".book-item-menu-area .book-theme-menu-button, .book-theme-menu-area .book-theme-menu-button",
        titulo: "Gerencie sua estante",
        texto:
          "Os menus de três pontos permitem editar, renomear ou excluir itens conforme o contexto.",
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
                  TOUR GUIADO
                </span>

                <strong className="guided-tour-section">
                  {tour.titulo}
                </strong>

                <small>
                  Passo {passoAtual + 1} de{" "}
                  {total}
                </small>
              </div>

              <button
                type="button"
                className="guided-tour-close"
                aria-label="Fechar tour"
                onClick={concluir}
              >
                <X size={18} />
              </button>
            </div>

            <div className="guided-tour-copy">
              <h3>
                {passo.titulo}
              </h3>

              <p>
                {passo.texto}
              </p>
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
              <button
                type="button"
                className="guided-tour-skip"
                onClick={concluir}
              >
                Pular tour
              </button>

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
                      concluir();
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
                    ? "Concluir"
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
