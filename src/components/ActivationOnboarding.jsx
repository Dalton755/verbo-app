import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  LibraryBig,
  Mic2,
  Sparkles,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../contexts/AuthContext";

import {
  supabase,
} from "../lib/supabase";

const VERSAO_ATIVACAO = "v2";

const OBJETIVOS = [
  {
    id: "sermoes",
    titulo: "Preparar uma pregação",
    descricao:
      "Veja como transformar seu esboço em uma experiência pronta para preparar e pregar.",
    rota: "/sermoes",
    icone: Mic2,
    beneficios: [
      "Modo Pregação limpo para o púlpito",
      "Referências bíblicas acessíveis no material",
      "Notas, marcadores e continuidade do preparo",
    ],
    acao: "Ver como o VERBO prepara um sermão",
  },
  {
    id: "ebd",
    titulo: "Preparar uma aula de EBD",
    descricao:
      "Entenda como organizar o trimestre, importar a aula e apresentar sem sair do fluxo.",
    rota: "/ebd",
    icone: BookOpen,
    beneficios: [
      "Trimestres e aulas organizados",
      "Apresentação pensada para ensinar",
      "Referências bíblicas durante a aula",
    ],
    acao: "Ver como o VERBO organiza uma aula",
  },
  {
    id: "livros",
    titulo: "Estudar um livro",
    descricao:
      "Veja como um PDF vira uma leitura mais prática para estudo, consulta e anotações.",
    rota: "/livros",
    icone: LibraryBig,
    beneficios: [
      "Leitura adaptada ao celular",
      "Busca, marcadores, notas e destaques",
      "Continuidade de onde você parou",
    ],
    acao: "Ver como o VERBO melhora a leitura",
  },
];

function chaveAtivacao(usuarioId) {
  return `verbo-ativacao:${VERSAO_ATIVACAO}:${usuarioId}`;
}

function ActivationOnboarding() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [objetivoId, setObjetivoId] = useState(null);

  const objetivo = useMemo(
    () =>
      OBJETIVOS.find(
        (item) => item.id === objetivoId,
      ) ?? null,
    [objetivoId],
  );

  useEffect(() => {
    if (
      !user?.id ||
      location.pathname !== "/"
    ) {
      setAberto(false);
      setCarregando(false);
      return;
    }

    let ativo = true;

    async function verificarPrimeiraExperiencia() {
      try {
        const salvo =
          localStorage.getItem(
            chaveAtivacao(user.id),
          );

        if (salvo) {
          if (ativo) {
            setAberto(false);
            setCarregando(false);
          }
          return;
        }
      } catch {
        // Continua pela verificação remota.
      }

      const {
        data,
        error,
      } = await supabase
        .schema("biblia_slides")
        .rpc("meu_armazenamento_por_modulo");

      if (!ativo) return;

      if (error) {
        console.debug(
          "Não foi possível verificar ativação inicial:",
          error,
        );

        setAberto(false);
        setCarregando(false);
        return;
      }

      const totalArquivos =
        (data ?? []).reduce(
          (total, item) =>
            total +
            Number(
              item?.total_arquivos ?? 0,
            ),
          0,
        );

      setCarregando(false);

      if (totalArquivos > 0) {
        setAberto(false);
        return;
      }

      window.setTimeout(() => {
        if (ativo) {
          setAberto(true);
        }
      }, 320);
    }

    verificarPrimeiraExperiencia();

    return () => {
      ativo = false;
    };
  }, [
    user?.id,
    location.pathname,
  ]);

  function salvarEstado(estado) {
    if (!user?.id) return;

    try {
      localStorage.setItem(
        chaveAtivacao(user.id),
        JSON.stringify({
          estado,
          objetivo:
            objetivo?.id ?? null,
          em: new Date().toISOString(),
        }),
      );
    } catch {
      // O onboarding segue mesmo sem armazenamento local.
    }
  }

  function comecarExperiencia() {
    if (!objetivo) return;

    salvarEstado("iniciado");
    setAberto(false);

    navigate(objetivo.rota, {
      state: {
        origemAtivacao: true,
      },
    });
  }

  function explorarSozinho() {
    salvarEstado("dispensado");
    setAberto(false);
  }

  if (
    carregando ||
    !aberto ||
    !user?.id ||
    location.pathname !== "/"
  ) {
    return null;
  }

  return (
    <div
      className="activation-onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Primeira experiência no VERBO"
    >
      <div className="activation-onboarding-card">
        {!objetivo ? (
          <>
            <div className="activation-onboarding-brand">
              <div>
                <Sparkles size={20} />
              </div>

              <span>
                SUA PRIMEIRA EXPERIÊNCIA
              </span>
            </div>

            <div className="activation-onboarding-copy">
              <p className="activation-onboarding-kicker">
                Antes de importar qualquer arquivo
              </p>

              <h2>
                Descubra em 1 minuto por que o VERBO é diferente.
              </h2>

              <p>
                Escolha o que você quer fazer. O VERBO vai mostrar exatamente os recursos que importam para esse objetivo e, no final, já abre a ação para você usar seu próprio material.
              </p>
            </div>

            <div className="activation-goal-grid">
              {OBJETIVOS.map((item) => {
                const Icone =
                  item.icone;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="activation-goal-card"
                    onClick={() =>
                      setObjetivoId(
                        item.id,
                      )
                    }
                  >
                    <div className="activation-goal-icon">
                      <Icone size={22} />
                    </div>

                    <div>
                      <strong>
                        {item.titulo}
                      </strong>

                      <span>
                        {item.descricao}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="activation-onboarding-footnote">
              <CheckCircle2 size={16} />
              <span>
                Sem configuração complicada. Você aprende vendo o app funcionar.
              </span>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="activation-back"
              onClick={() =>
                setObjetivoId(null)
              }
            >
              <ArrowLeft size={16} />
              Voltar
            </button>

            <div className="activation-onboarding-brand">
              <div>
                <Sparkles size={20} />
              </div>

              <span>
                DEMONSTRAÇÃO RÁPIDA
              </span>
            </div>

            <div className="activation-onboarding-copy">
              <p className="activation-onboarding-kicker">
                {objetivo.titulo}
              </p>

              <h2>
                Você vai aprender algo que já pode usar hoje.
              </h2>

              <p>
                O tutorial vai destacar só o que faz diferença nessa tarefa. Nada de apresentar botão por botão.
              </p>
            </div>

            <div className="activation-benefit-list">
              {objetivo.beneficios.map(
                (beneficio) => (
                  <div key={beneficio}>
                    <CheckCircle2
                      size={18}
                    />
                    <span>
                      {beneficio}
                    </span>
                  </div>
                ),
              )}
            </div>

            <div className="activation-onboarding-actions">
              <button
                type="button"
                className="primary-button activation-start-button"
                onClick={
                  comecarExperiencia
                }
              >
                {objetivo.acao}
              </button>

              <button
                type="button"
                className="activation-explore-alone"
                onClick={
                  explorarSozinho
                }
              >
                Prefiro explorar sozinho
              </button>
            </div>

            <p className="activation-time-note">
              Leva cerca de 1 minuto. No último passo o VERBO já abre sua primeira ação.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ActivationOnboarding;
