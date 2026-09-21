import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  CreditCard,
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
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

  const carregar = useCallback(
    async () => {
      setCarregando(true);
      setErro("");

      const {
        data,
        error,
      } = await supabase
        .schema("biblia_slides")
        .rpc("admin_dashboard");

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

      setDados(data);
      setCarregando(false);
    },
    [],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

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
                    dados
                      ?.clientes_recentes ??
                    []
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
    </div>
  );
}

export default AdminDashboardPage;
