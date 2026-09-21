import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  CreditCard,
  Database,
  HardDrive,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

function formatarMoeda(valor) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(Number(valor ?? 0));
}

function formatarBytes(bytes) {
  const valor = Number(bytes ?? 0);

  if (valor <= 0) return "0 B";

  const unidades = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const indice = Math.min(
    Math.floor(
      Math.log(valor) /
      Math.log(1024),
    ),
    unidades.length - 1,
  );

  const numero =
    valor /
    1024 ** indice;

  return `${numero.toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits:
        indice >= 2 ? 2 : 1,
    },
  )} ${unidades[indice]}`;
}

function formatarData(data) {
  if (!data) return "—";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(data));
}

function statusClasse(status) {
  const valor =
    String(status ?? "")
      .toUpperCase();

  if (
    [
      "APROVADO",
      "APPROVED",
      "PAGO",
      "PAID",
      "VITALICIO",
      "LIBERADO",
      "ATIVA",
      "ATIVO",
    ].includes(valor)
  ) {
    return "success";
  }

  if (
    [
      "PENDENTE",
      "PENDING",
      "TESTE",
    ].includes(valor)
  ) {
    return "warning";
  }

  if (
    [
      "REEMBOLSADO",
      "REFUNDED",
      "CANCELADO",
      "CANCELLED",
      "EXPIRADO",
    ].includes(valor)
  ) {
    return "danger";
  }

  return "neutral";
}

function AdminDashboardPage() {
  const navigate = useNavigate();

  const [
    dados,
    setDados,
  ] = useState(null);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    usuariosGerenciais,
    setUsuariosGerenciais,
  ] = useState([]);

  const [
    feedbackGerencial,
    setFeedbackGerencial,
  ] = useState(null);

  const [
    liberacaoAberta,
    setLiberacaoAberta,
  ] = useState(false);

  const [
    usuarioLiberacao,
    setUsuarioLiberacao,
  ] = useState("");

  const [
    limiteMb,
    setLimiteMb,
  ] = useState("25");

  const [
    duracaoVitalicia,
    setDuracaoVitalicia,
  ] = useState(false);

  const [
    mesesLiberacao,
    setMesesLiberacao,
  ] = useState("1");

  const [
    salvandoLiberacao,
    setSalvandoLiberacao,
  ] = useState(false);

  const [
    erroLiberacao,
    setErroLiberacao,
  ] = useState("");

  const [
    sucessoLiberacao,
    setSucessoLiberacao,
  ] = useState("");

  const carregar = useCallback(
    async () => {
      setCarregando(true);
      setErro("");

      const [
        painelResposta,
        usuariosResposta,
        feedbackResposta,
      ] = await Promise.all([
        supabase
          .schema("biblia_slides")
          .rpc("admin_dashboard"),

        supabase
          .schema("biblia_slides")
          .rpc("admin_listar_usuarios"),

        supabase
          .schema("biblia_slides")
          .rpc("admin_feedback"),
      ]);

      const error =
        painelResposta.error ||
        usuariosResposta.error ||
        feedbackResposta.error;

      if (error) {
        console.error(
          "Erro no painel gerencial:",
          error,
        );

        setErro(
          error.message?.includes(
            "ACESSO_ADMIN_NEGADO",
          )
            ? "Esta conta não possui acesso ao painel gerencial."
            : "Não foi possível carregar os dados do painel.",
        );

        setCarregando(false);
        return;
      }

      setDados(
        painelResposta.data,
      );

      setUsuariosGerenciais(
        Array.isArray(
          usuariosResposta.data,
        )
          ? usuariosResposta.data
          : [],
      );

      setFeedbackGerencial(
        feedbackResposta.data ?? null,
      );

      setCarregando(false);
    },
    [],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirLiberacao() {
    setErroLiberacao("");
    setSucessoLiberacao("");

    if (
      !usuarioLiberacao &&
      usuariosGerenciais.length > 0
    ) {
      setUsuarioLiberacao(
        usuariosGerenciais[0].id,
      );
    }

    setLiberacaoAberta(true);
  }

  async function liberarAcesso() {
    setErroLiberacao("");
    setSucessoLiberacao("");

    const mb =
      Number(limiteMb);

    const meses =
      Number(mesesLiberacao);

    if (!usuarioLiberacao) {
      setErroLiberacao(
        "Escolha um usuário.",
      );
      return;
    }

    if (
      !Number.isInteger(mb) ||
      mb < 1 ||
      mb > 102400
    ) {
      setErroLiberacao(
        "Informe uma quantidade entre 1 e 102400 MB.",
      );
      return;
    }

    if (
      !duracaoVitalicia &&
      (
        !Number.isInteger(meses) ||
        meses < 1 ||
        meses > 120
      )
    ) {
      setErroLiberacao(
        "Informe uma duração entre 1 e 120 meses.",
      );
      return;
    }

    setSalvandoLiberacao(true);

    const {
      data,
      error,
    } = await supabase
      .schema("biblia_slides")
      .rpc(
        "admin_liberar_acesso",
        {
          p_usuario_id:
            usuarioLiberacao,

          p_limite_mb:
            mb,

          p_meses:
            duracaoVitalicia
              ? null
              : meses,

          p_vitalicio:
            duracaoVitalicia,
        },
      );

    if (error) {
      console.error(
        "Erro ao liberar acesso:",
        error,
      );

      setErroLiberacao(
        "Não foi possível liberar o acesso.",
      );

      setSalvandoLiberacao(false);
      return;
    }

    const usuario =
      usuariosGerenciais.find(
        (item) =>
          item.id ===
          usuarioLiberacao,
      );

    setSucessoLiberacao(
      `Acesso de ${usuario?.nome || usuario?.email || "usuário"} liberado com ${mb} MB ${duracaoVitalicia ? "em caráter vitalício" : `por ${meses} mês(es)`}.`,
    );

    setSalvandoLiberacao(false);

    await carregar();

    if (data?.ok !== true) {
      setErroLiberacao(
        "A liberação foi processada, mas a confirmação retornou incompleta.",
      );
    }
  }

  const maxCadastros =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            dados?.historico_14d ??
            []
          ).map(
            (item) =>
              Number(
                item.cadastros ??
                0,
              ),
          ),
        ),
      [dados],
    );

  const maxReceita =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            dados?.historico_14d ??
            []
          ).map(
            (item) =>
              Number(
                item.receita ??
                0,
              ),
          ),
        ),
      [dados],
    );

  if (carregando) {
    return (
      <div className="admin-dashboard-loading">
        <div className="loading-dot" />

        <p>
          Preparando seu painel gerencial...
        </p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="admin-dashboard-loading">
        <ShieldCheck size={34} />

        <h2>
          Painel gerencial
        </h2>

        <p>
          {erro}
        </p>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            navigate("/")
          }
        >
          <ArrowLeft size={18} />
          Voltar ao VERBO
        </button>
      </div>
    );
  }

  const usuarios =
    dados?.usuarios ?? {};

  const assinaturas =
    dados?.assinaturas ?? {};

  const armazenamento =
    dados?.armazenamento ?? {};

  const financeiro =
    dados?.financeiro ?? {};

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-topbar">
        <div>
          <span>
            VERBO · ADMIN
          </span>

          <h1>
            Painel gerencial
          </h1>

          <p>
            Visão geral de clientes,
            assinaturas, uso e faturamento.
          </p>
        </div>

        <div className="admin-dashboard-top-actions">
          <button
            type="button"
            className="admin-release-button"
            onClick={abrirLiberacao}
          >
            <KeyRound size={18} />
            <span>
              Liberar acesso
            </span>
          </button>

          <button
            type="button"
            className="admin-icon-button"
            title="Atualizar"
            onClick={carregar}
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="admin-icon-button"
            title="Voltar"
            onClick={() =>
              navigate("/")
            }
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </header>

      <main className="admin-dashboard-content">
        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Audiência
              </span>

              <h2>
                Usuários e acessos
              </h2>
            </div>

            <Users size={22} />
          </div>

          <div className="admin-metric-grid">
            <article className="admin-metric-card primary">
              <div className="admin-metric-icon">
                <Users size={20} />
              </div>

              <span>
                Usuários cadastrados
              </span>

              <strong>
                {usuarios.total ?? 0}
              </strong>

              <small>
                +{usuarios.novos_7d ?? 0}
                {" "}nos últimos 7 dias
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <Activity size={20} />
              </div>

              <span>
                Entraram hoje
              </span>

              <strong>
                {usuarios.entraram_hoje ?? 0}
              </strong>

              <small>
                {usuarios.entraram_7d ?? 0}
                {" "}usuários ativos em 7 dias
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <UserCheck size={20} />
              </div>

              <span>
                Testes ativos
              </span>

              <strong>
                {usuarios.teste_ativos ?? 0}
              </strong>

              <small>
                {usuarios.teste_expirados ?? 0}
                {" "}testes expirados
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <CalendarDays size={20} />
              </div>

              <span>
                Novos hoje
              </span>

              <strong>
                {usuarios.novos_hoje ?? 0}
              </strong>

              <small>
                {usuarios.novos_30d ?? 0}
                {" "}novos em 30 dias
              </small>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Comercial
              </span>

              <h2>
                Assinaturas e licenças
              </h2>
            </div>

            <CreditCard size={22} />
          </div>

          <div className="admin-metric-grid">
            <article className="admin-metric-card success">
              <div className="admin-metric-icon">
                <ShieldCheck size={20} />
              </div>

              <span>
                Vitalícios ativos
              </span>

              <strong>
                {
                  assinaturas
                    .vitalicias_ativas ??
                  0
                }
              </strong>

              <small>
                {
                  assinaturas
                    .vitalicias_mercado_pago ??
                  0
                }
                {" "}via Mercado Pago
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <Database size={20} />
              </div>

              <span>
                Assinaturas de espaço
              </span>

              <strong>
                {
                  assinaturas
                    .armazenamento_ativas ??
                  0
                }
              </strong>

              <small>
                Planos mensais ativos
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <TrendingUp size={20} />
              </div>

              <span>
                Receita recorrente
              </span>

              <strong className="admin-money">
                {formatarMoeda(
                  assinaturas.mrr,
                )}
              </strong>

              <small>
                MRR atual de armazenamento
              </small>
            </article>

            <article className="admin-metric-card">
              <div className="admin-metric-icon">
                <BadgeDollarSign size={20} />
              </div>

              <span>
                Conversão vitalícia
              </span>

              <strong>
                {usuarios.total
                  ? (
                      (
                        Number(
                          assinaturas
                            .vitalicias_ativas ??
                            0,
                        ) /
                        Number(
                          usuarios.total,
                        )
                      ) *
                      100
                    ).toLocaleString(
                      "pt-BR",
                      {
                        maximumFractionDigits:
                          1,
                      },
                    )
                  : "0"}
                %
              </strong>

              <small>
                Vitalícios ÷ usuários cadastrados
              </small>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Infraestrutura
              </span>

              <h2>
                Consumo de dados
              </h2>
            </div>

            <HardDrive size={22} />
          </div>

          <div className="admin-storage-layout">
            <article className="admin-storage-total">
              <span>
                Armazenamento utilizado
              </span>

              <strong>
                {formatarBytes(
                  armazenamento
                    .total_bytes,
                )}
              </strong>

              <p>
                {
                  armazenamento
                    .total_arquivos ??
                  0
                }
                {" "}arquivos armazenados
              </p>

              <div className="admin-storage-mini">
                <div>
                  <span>
                    PDFs
                  </span>

                  <strong>
                    {formatarBytes(
                      armazenamento
                        .pdf_bytes,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Capas
                  </span>

                  <strong>
                    {formatarBytes(
                      armazenamento
                        .capas_bytes,
                    )}
                  </strong>
                </div>
              </div>
            </article>

            <div className="admin-storage-modules">
              {[
                {
                  nome: "EBD",
                  valor:
                    armazenamento
                      .ebd_bytes,
                },
                {
                  nome: "Sermões",
                  valor:
                    armazenamento
                      .sermoes_bytes,
                },
                {
                  nome: "Livros",
                  valor:
                    armazenamento
                      .livros_bytes,
                },
              ].map((item) => {
                const total =
                  Math.max(
                    1,
                    Number(
                      armazenamento
                        .pdf_bytes ??
                        0,
                    ),
                  );

                const percentual =
                  Math.min(
                    100,
                    (
                      Number(
                        item.valor ??
                          0,
                      ) /
                      total
                    ) *
                      100,
                  );

                return (
                  <article
                    key={item.nome}
                    className="admin-storage-module"
                  >
                    <div>
                      <span>
                        {item.nome}
                      </span>

                      <strong>
                        {formatarBytes(
                          item.valor,
                        )}
                      </strong>
                    </div>

                    <div className="admin-storage-bar">
                      <div
                        style={{
                          width:
                            `${percentual}%`,
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Financeiro
              </span>

              <h2>
                Faturamento
              </h2>
            </div>

            <WalletCards size={22} />
          </div>

          <div className="admin-metric-grid">
            <article className="admin-metric-card finance">
              <span>
                Receita aprovada
              </span>

              <strong className="admin-money">
                {formatarMoeda(
                  financeiro.receita_total,
                )}
              </strong>

              <small>
                Total histórico aprovado
              </small>
            </article>

            <article className="admin-metric-card finance">
              <span>
                Receita no mês
              </span>

              <strong className="admin-money">
                {formatarMoeda(
                  financeiro.receita_mes,
                )}
              </strong>

              <small>
                {
                  formatarMoeda(
                    financeiro
                      .receita_hoje,
                  )
                }
                {" "}hoje
              </small>
            </article>

            <article className="admin-metric-card">
              <span>
                Ticket médio
              </span>

              <strong className="admin-money">
                {formatarMoeda(
                  financeiro.ticket_medio,
                )}
              </strong>

              <small>
                Por pagamento aprovado
              </small>
            </article>

            <article className="admin-metric-card">
              <span>
                Valores pendentes
              </span>

              <strong className="admin-money">
                {formatarMoeda(
                  financeiro.pendente,
                )}
              </strong>

              <small>
                Reembolsados:{" "}
                {formatarMoeda(
                  financeiro.reembolsado,
                )}
              </small>
            </article>
          </div>

          <div className="admin-finance-split">
            <article>
              <span>
                Licenças do app
              </span>

              <strong>
                {formatarMoeda(
                  financeiro
                    .receita_licencas,
                )}
              </strong>
            </article>

            <article>
              <span>
                Armazenamento
              </span>

              <strong>
                {formatarMoeda(
                  financeiro
                    .receita_armazenamento,
                )}
              </strong>
            </article>

            <article>
              <span>
                MRR contratado
              </span>

              <strong>
                {formatarMoeda(
                  assinaturas.mrr,
                )}
              </strong>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Últimos 14 dias
              </span>

              <h2>
                Evolução
              </h2>
            </div>

            <TrendingUp size={22} />
          </div>

          <div className="admin-chart-grid">
            <article className="admin-chart-card">
              <div className="admin-chart-head">
                <div>
                  <span>
                    Cadastros
                  </span>

                  <strong>
                    Crescimento diário
                  </strong>
                </div>
              </div>

              <div className="admin-bars">
                {(
                  dados
                    ?.historico_14d ??
                  []
                ).map((item) => {
                  const valor =
                    Number(
                      item.cadastros ??
                        0,
                    );

                  return (
                    <div
                      key={item.data}
                      className="admin-bar-column"
                      title={`${item.data}: ${valor} cadastro(s)`}
                    >
                      <div className="admin-bar-track">
                        <div
                          style={{
                            height:
                              `${Math.max(
                                valor > 0
                                  ? 8
                                  : 0,
                                (valor /
                                  maxCadastros) *
                                  100,
                              )}%`,
                          }}
                        />
                      </div>

                      <span>
                        {new Date(
                          `${item.data}T12:00:00`,
                        ).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="admin-chart-card">
              <div className="admin-chart-head">
                <div>
                  <span>
                    Receita
                  </span>

                  <strong>
                    Faturamento diário
                  </strong>
                </div>
              </div>

              <div className="admin-bars money">
                {(
                  dados
                    ?.historico_14d ??
                  []
                ).map((item) => {
                  const valor =
                    Number(
                      item.receita ??
                        0,
                    );

                  return (
                    <div
                      key={item.data}
                      className="admin-bar-column"
                      title={`${item.data}: ${formatarMoeda(valor)}`}
                    >
                      <div className="admin-bar-track">
                        <div
                          style={{
                            height:
                              `${Math.max(
                                valor > 0
                                  ? 8
                                  : 0,
                                (valor /
                                  maxReceita) *
                                  100,
                              )}%`,
                          }}
                        />
                      </div>

                      <span>
                        {new Date(
                          `${item.data}T12:00:00`,
                        ).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <div>
              <span>
                Experiência
              </span>

              <h2>
                Avaliações dos usuários
              </h2>
            </div>

            <MessageSquareText size={22} />
          </div>

          <div className="admin-feedback-summary">
            <article className="admin-feedback-score">
              <span>
                Nota média
              </span>

              <strong>
                {Number(
                  feedbackGerencial?.media ?? 0,
                ).toLocaleString(
                  "pt-BR",
                  {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  },
                )}
              </strong>

              <div className="admin-feedback-stars">
                {[1, 2, 3, 4, 5].map(
                  (valor) => (
                    <Star
                      key={valor}
                      size={18}
                      fill={
                        Number(
                          feedbackGerencial?.media ?? 0,
                        ) >= valor
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ),
                )}
              </div>

              <small>
                {feedbackGerencial?.total ?? 0}
                {" "}avaliação(ões)
              </small>
            </article>

            <article className="admin-feedback-positive">
              <span>
                Avaliações positivas
              </span>

              <strong>
                {feedbackGerencial?.total
                  ? (
                      (
                        Number(
                          feedbackGerencial?.positivas ?? 0,
                        ) /
                        Number(
                          feedbackGerencial.total,
                        )
                      ) *
                      100
                    ).toLocaleString(
                      "pt-BR",
                      {
                        maximumFractionDigits: 1,
                      },
                    )
                  : "0"}
                %
              </strong>

              <small>
                Notas 4 e 5
              </small>
            </article>

            <article className="admin-feedback-distribution">
              {[5, 4, 3, 2, 1].map(
                (valor) => {
                  const quantidade =
                    Number(
                      feedbackGerencial?.[
                        `nota_${valor}`
                      ] ?? 0,
                    );

                  const total =
                    Math.max(
                      1,
                      Number(
                        feedbackGerencial?.total ?? 0,
                      ),
                    );

                  return (
                    <div
                      key={valor}
                      className="admin-feedback-distribution-row"
                    >
                      <span>
                        {valor}
                        <Star
                          size={13}
                          fill="currentColor"
                        />
                      </span>

                      <div>
                        <i
                          style={{
                            width:
                              `${(quantidade / total) * 100}%`,
                          }}
                        />
                      </div>

                      <strong>
                        {quantidade}
                      </strong>
                    </div>
                  );
                },
              )}
            </article>
          </div>

          <article className="admin-list-card admin-feedback-list-card">
            <div className="admin-list-head">
              <div>
                <span>
                  Feedback
                </span>

                <h3>
                  Comentários recentes
                </h3>
              </div>
            </div>

            {(
              feedbackGerencial?.recentes ?? []
            ).length === 0 ? (
              <div className="admin-feedback-empty">
                Ainda não há avaliações enviadas.
              </div>
            ) : (
              <div className="admin-feedback-cards">
                {(
                  feedbackGerencial?.recentes ?? []
                ).map(
                  (item) => (
                    <article
                      key={item.id}
                      className="admin-feedback-card"
                    >
                      <div className="admin-feedback-card-head">
                        <div>
                          <strong>
                            {item.nome || "Usuário"}
                          </strong>

                          <span>
                            {item.email}
                          </span>
                        </div>

                        <div className="admin-feedback-card-rating">
                          <Star
                            size={15}
                            fill="currentColor"
                          />

                          <strong>
                            {item.nota}/5
                          </strong>
                        </div>
                      </div>

                      {item.comentario ? (
                        <p>
                          “{item.comentario}”
                        </p>
                      ) : (
                        <p className="muted">
                          Avaliou sem comentário.
                        </p>
                      )}

                      <small>
                        {formatarData(
                          item.created_at,
                        )}
                      </small>
                    </article>
                  ),
                )}
              </div>
            )}
          </article>
        </section>

        <section className="admin-two-columns">
          <article className="admin-list-card">
            <div className="admin-list-head">
              <div>
                <span>
                  Clientes
                </span>

                <h3>
                  Cadastros recentes
                </h3>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      Cliente
                    </th>

                    <th>
                      Acesso
                    </th>

                    <th>
                      Dados
                    </th>

                    <th>
                      Cadastro
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    usuariosGerenciais.length > 0
                      ? usuariosGerenciais.slice(
                          0,
                          12,
                        )
                      : (
                          dados
                            ?.clientes_recentes ??
                          []
                        )
                  ).map(
                    (cliente) => (
                      <tr
                        key={
                          cliente.id
                        }
                      >
                        <td>
                          <strong>
                            {cliente.nome ||
                              "Sem nome"}
                          </strong>

                          <span>
                            {cliente.email}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              `admin-status ${statusClasse(
                                cliente.acesso,
                              )}`
                            }
                          >
                            {cliente.acesso}
                          </span>
                        </td>

                        <td>
                          {formatarBytes(
                            cliente
                              .storage_bytes,
                          )}
                        </td>

                        <td>
                          {formatarData(
                            cliente
                              .created_at,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="admin-list-card">
            <div className="admin-list-head">
              <div>
                <span>
                  Financeiro
                </span>

                <h3>
                  Pagamentos recentes
                </h3>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      Cliente
                    </th>

                    <th>
                      Finalidade
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Valor
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    dados
                      ?.pagamentos_recentes ??
                    []
                  ).map(
                    (pagamento) => (
                      <tr
                        key={
                          pagamento.id
                        }
                      >
                        <td>
                          <strong>
                            {pagamento.nome ||
                              "Cliente"}
                          </strong>

                          <span>
                            {pagamento.email}
                          </span>
                        </td>

                        <td>
                          {pagamento
                            .finalidade ||
                            "—"}
                        </td>

                        <td>
                          <span
                            className={
                              `admin-status ${statusClasse(
                                pagamento.status,
                              )}`
                            }
                          >
                            {pagamento.status}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {formatarMoeda(
                              pagamento.valor,
                            )}
                          </strong>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <footer className="admin-dashboard-footer">
          <span>
            Última atualização:{" "}
            {formatarData(
              dados?.gerado_em,
            )}
          </span>

          <span>
            Valores financeiros exibem registros
            do banco do VERBO.
          </span>
        </footer>
      </main>

      {liberacaoAberta && (
        <div
          className="admin-release-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Liberar acesso"
        >
          <div className="admin-release-modal">
            <div className="admin-release-head">
              <div>
                <span>
                  ACESSO ADMINISTRATIVO
                </span>

                <h2>
                  Liberar acesso
                </h2>

                <p>
                  Escolha o usuário, defina o espaço e por quanto tempo o acesso ficará liberado.
                </p>
              </div>

              <button
                type="button"
                className="admin-release-close"
                aria-label="Fechar"
                onClick={() =>
                  setLiberacaoAberta(
                    false,
                  )
                }
              >
                <X size={19} />
              </button>
            </div>

            <div className="admin-release-form">
              <label>
                <span>
                  Usuário
                </span>

                <select
                  value={
                    usuarioLiberacao
                  }
                  onChange={(event) => {
                    setUsuarioLiberacao(
                      event.target.value,
                    );

                    setErroLiberacao("");
                    setSucessoLiberacao("");
                  }}
                >
                  <option value="">
                    Selecione um usuário
                  </option>

                  {usuariosGerenciais.map(
                    (usuario) => (
                      <option
                        key={usuario.id}
                        value={usuario.id}
                      >
                        {usuario.nome ||
                          "Sem nome"}{" "}
                        — {usuario.email}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {usuarioLiberacao && (
                <div className="admin-release-current">
                  {(() => {
                    const usuario =
                      usuariosGerenciais.find(
                        (item) =>
                          item.id ===
                          usuarioLiberacao,
                      );

                    if (!usuario) {
                      return null;
                    }

                    return (
                      <>
                        <div>
                          <span>
                            Acesso atual
                          </span>

                          <strong>
                            {usuario.acesso}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Uso atual
                          </span>

                          <strong>
                            {formatarBytes(
                              usuario.storage_bytes,
                            )}
                          </strong>
                        </div>

                        {usuario.liberacao_mb && (
                          <div>
                            <span>
                              Liberação atual
                            </span>

                            <strong>
                              {usuario.liberacao_mb} MB
                            </strong>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <label>
                <span>
                  Espaço liberado
                </span>

                <div className="admin-input-with-suffix">
                  <input
                    type="number"
                    min="1"
                    max="102400"
                    step="1"
                    inputMode="numeric"
                    value={limiteMb}
                    onChange={(event) =>
                      setLimiteMb(
                        event.target.value,
                      )
                    }
                  />

                  <strong>
                    MB
                  </strong>
                </div>
              </label>

              <div className="admin-release-duration">
                <span className="admin-release-label">
                  Duração do acesso
                </span>

                <div className="admin-release-options">
                  <button
                    type="button"
                    className={
                      !duracaoVitalicia
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDuracaoVitalicia(
                        false,
                      )
                    }
                  >
                    Por meses
                  </button>

                  <button
                    type="button"
                    className={
                      duracaoVitalicia
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDuracaoVitalicia(
                        true,
                      )
                    }
                  >
                    Vitalício
                  </button>
                </div>
              </div>

              {!duracaoVitalicia && (
                <label>
                  <span>
                    Quantos meses
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    inputMode="numeric"
                    value={
                      mesesLiberacao
                    }
                    onChange={(event) =>
                      setMesesLiberacao(
                        event.target.value,
                      )
                    }
                  />
                </label>
              )}

              <div className="admin-release-note">
                <ShieldCheck size={18} />

                <p>
                  Esta liberação dá acesso ao VERBO e usa a quantidade de MB definida aqui. Ela não cria cobrança no Mercado Pago.
                </p>
              </div>

              {erroLiberacao && (
                <div className="admin-release-message error">
                  {erroLiberacao}
                </div>
              )}

              {sucessoLiberacao && (
                <div className="admin-release-message success">
                  {sucessoLiberacao}
                </div>
              )}
            </div>

            <div className="admin-release-actions">
              <button
                type="button"
                className="admin-release-cancel"
                disabled={
                  salvandoLiberacao
                }
                onClick={() =>
                  setLiberacaoAberta(
                    false,
                  )
                }
              >
                Fechar
              </button>

              <button
                type="button"
                className="admin-release-submit"
                disabled={
                  salvandoLiberacao
                }
                onClick={
                  liberarAcesso
                }
              >
                <KeyRound size={18} />

                {salvandoLiberacao
                  ? "Liberando..."
                  : "Liberar acesso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
