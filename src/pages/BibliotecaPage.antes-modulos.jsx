import {
  useEffect,
  useState,
} from "react";

import {
  BookOpen,
  ChevronRight,
  HardDrive,
  LibraryBig,
  LogOut,
  Mic2,
  Plus,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { supabase } from "../lib/supabase";

import { useAuth } from "../contexts/AuthContext";
import { useLicense } from "../contexts/LicenseContext";

import StorageUpgradeModal from "../components/StorageUpgradeModal";
import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function BibliotecaPage() {
  const navigate = useNavigate();
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const {
    sair,
    user,
  } = useAuth();

  const {
    emTeste,
    diasRestantes,
  } = useLicense();

  const [
    armazenamento,
    setArmazenamento,
  ] = useState(null);

  const [
    carregandoArmazenamento,
    setCarregandoArmazenamento,
  ] = useState(true);

  const [
    erroArmazenamento,
    setErroArmazenamento,
  ] = useState("");

  const [
    armazenamentoModulos,
    setArmazenamentoModulos,
  ] = useState({});

  const [
    upgradeAberto,
    setUpgradeAberto,
  ] = useState(false);

  const [
    mensagemUpgrade,
    setMensagemUpgrade,
  ] = useState("");

  function formatarBytes(bytes) {
    const valor = Number(bytes ?? 0);

    if (valor >= 1024 ** 3) {
      const gb =
        valor / (1024 ** 3);

      return `${gb.toLocaleString(
        "pt-BR",
        {
          maximumFractionDigits: 2,
        },
      )} GB`;
    }

    if (valor >= 1024 ** 2) {
      const mb =
        valor / (1024 ** 2);

      return `${mb.toLocaleString(
        "pt-BR",
        {
          maximumFractionDigits:
            mb >= 100 ? 0 : 2,
        },
      )} MB`;
    }

    if (valor >= 1024) {
      const kb =
        valor / 1024;

      return `${kb.toLocaleString(
        "pt-BR",
        {
          maximumFractionDigits: 1,
        },
      )} KB`;
    }

    return `${valor.toLocaleString(
      "pt-BR",
    )} bytes`;
  }

  useEffect(() => {
    if (!user) return;

    let ativo = true;

    async function carregarArmazenamento() {
      const {
        data,
        error,
      } =
        await supabase
          .schema("biblia_slides")
          .rpc(
            "meu_armazenamento",
          )
          .single();

      const {
        data: modulosData,
        error: modulosError,
      } =
        await supabase
          .schema("biblia_slides")
          .rpc(
            "meu_armazenamento_por_modulo",
          );

      if (!ativo) return;

      if (modulosError) {
        console.error(
          "Erro ao carregar armazenamento por módulo:",
          modulosError,
        );
      }

      if (error) {
        console.error(
          "Erro ao carregar armazenamento:",
          error,
        );

        setArmazenamento(null);

        setErroArmazenamento(
          "Não conseguimos consultar seu armazenamento.",
        );

        setCarregandoArmazenamento(false);
        return;
      }

      setArmazenamento(data);
      const mapaModulos = {};

      for (
        const item of
        modulosData ?? []
      ) {
        mapaModulos[
          item.modulo
        ] = {
          totalArquivos:
            Number(
              item.total_arquivos ??
              0,
            ),

          usadoBytes:
            Number(
              item.usado_bytes ??
              0,
            ),
        };
      }

      setArmazenamentoModulos(
        mapaModulos,
      );

      setErroArmazenamento("");
      setCarregandoArmazenamento(false);
    }

    carregarArmazenamento();

    return () => {
      ativo = false;
    };
  }, [user]);

  useEffect(() => {
    const statusUpgrade =
      searchParams.get(
        "upgrade",
      );

    const pagamentoId =
      searchParams.get(
        "pagamento",
      );


    if (
      !user ||
      !pagamentoId ||
      (
        statusUpgrade !==
        "aprovado" &&
        statusUpgrade !==
        "pendente"
      )
    ) {
      return;
    }


    let cancelado =
      false;


    async function finalizarUpgrade() {
      /*
       * Mercado Pago pode redirecionar
       * alguns instantes antes de a Order
       * ficar disponível como creditada.
       */
      const maxTentativas =
        10;


      for (
        let tentativa = 1;
        tentativa <=
        maxTentativas;
        tentativa += 1
      ) {
        if (cancelado) {
          return;
        }


        try {
          const {
            data,
            error,
          } =
            await supabase
              .functions
              .invoke(
                "trocar-plano-armazenamento",
                {
                  body: {
                    pagamentoId,
                  },
                },
              );


          if (error) {
            console.error(
              "Erro ao finalizar upgrade:",
              error,
            );

            throw error;
          }


          if (data?.ok) {
            /*
             * Remove os parâmetros para
             * impedir nova execução após
             * atualizar a página.
             */

            const planoConcluido =
              String(
                data?.planoDestino ?? "",
              )
                .replace(
                  "ESPACO_",
                  "",
                )
                .replace(
                  "MB",
                  " MB",
                );


            sessionStorage.setItem(
              "biblia-slides-upgrade-sucesso",
              planoConcluido
                ? `Upgrade concluído. Seu plano agora possui ${planoConcluido}.`
                : "Upgrade de armazenamento concluído com sucesso.",
            );


            setSearchParams(
              {},
              {
                replace: true,
              },
            );


            /*
             * Recarrega o armazenamento
             * já com o plano novo.
             */
            window.location.reload();

            return;
          }


          if (
            data?.processando
          ) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  1500,
                ),
            );

            continue;
          }


          throw new Error(
            data?.erro ||
            "Não foi possível concluir o upgrade.",
          );

        } catch (error) {
          console.error(
            "Falha ao concluir upgrade:",
            error,
          );

          /*
           * Erro definitivo:
           * não removemos os parâmetros.
           *
           * Assim é possível atualizar a
           * página e tentar novamente.
           */
          return;
        }
      }


      console.log(
        "Pagamento ainda aguardando confirmação.",
      );
    }


    finalizarUpgrade();


    return () => {
      cancelado =
        true;
    };

  }, [
    user,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const mensagem =
      sessionStorage.getItem(
        "biblia-slides-upgrade-sucesso",
      );


    if (!mensagem) {
      return;
    }


    sessionStorage.removeItem(
      "biblia-slides-upgrade-sucesso",
    );


    setMensagemUpgrade(
      mensagem,
    );


    const timer =
      setTimeout(() => {
        setMensagemUpgrade("");
      }, 6000);


    return () =>
      clearTimeout(timer);

  }, []);

  const percentualUsado =
    Math.min(
      Math.max(
        Number(
          armazenamento?.percentual_usado ??
          0,
        ),
        0,
      ),
      100,
    );

  const nivelArmazenamento =
    percentualUsado >= 90
      ? "critico"
      : percentualUsado >= 70
        ? "atencao"
        : "normal";

  const modulos = [
    {
      id: "ebd",
      titulo: "EBD",
      descricao:
        "Organize seus trimestres, aulas e apresentações bíblicas.",
      detalhe: "Trimestres e aulas",
      icon: BookOpen,
      rota: "/ebd",
      armazenamento:
        armazenamentoModulos.ebd,
    },

    {
      id: "sermoes",
      titulo: "Sermões",
      descricao:
        "Guarde seus esboços e pregue com uma tela limpa e assistida.",
      detalhe: "Modo Pregação",
      icon: Mic2,
      rota: "/sermoes",
      armazenamento:
        armazenamentoModulos.sermoes,
    },

    {
      id: "livros",
      titulo: "Livros",
      descricao:
        "Monte sua biblioteca cristã e leia seus PDFs com conforto.",
      detalhe: "Leitura responsiva",
      icon: LibraryBig,
      rota: "/livros",
      armazenamento:
        armazenamentoModulos.livros,
    },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand-group">
          <img
            src={verboLogoHorizontal}
            alt="VERBO"
            className="topbar-verbo-logo"
          />

          <div>
            <span className="app-kicker">
              Minha biblioteca

              {emTeste &&
                diasRestantes !== null && (
                  <>
                    {" · "}
                    Teste gratuito ·{" "}
                    {diasRestantes}{" "}
                    {diasRestantes === 1
                      ? "dia restante"
                      : "dias restantes"}
                  </>
                )}
            </span>

            <h1>Biblioteca</h1>
          </div>
        </div>

        <button
          className="icon-button"
          aria-label="Sair"
          title="Sair"
          onClick={sair}
        >
          <LogOut size={19} />
        </button>
      </header>

      <main className="page-content library-home">
        {mensagemUpgrade && (
          <div
            className="upgrade-success-message"
            role="status"
          >
            <strong>
              Upgrade concluído
            </strong>

            <span>
              {mensagemUpgrade}
            </span>
          </div>
        )}
        <section className="library-intro">
          <p className="eyebrow">
            Organize. Ensine. Pregue.
          </p>
        </section>

        <section className="module-grid">
          {modulos.map((modulo) => {
            const Icon = modulo.icon;

            return (
              <button
                key={modulo.id}
                type="button"
                className="module-card"
                onClick={() =>
                  navigate(modulo.rota)
                }
              >
                <div className="module-card-icon">
                  <Icon size={25} />
                </div>

                <div className="module-card-content">
                  <span>
                    {modulo.detalhe}
                  </span>

                  <h3>
                    {modulo.titulo}
                  </h3>

                  <p>
                    {modulo.descricao}
                  </p>

                  <div className="module-card-storage">
                    <span>
                      {modulo.armazenamento
                        ?.totalArquivos ??
                        0}{" "}
                      {modulo.armazenamento
                        ?.totalArquivos === 1
                        ? "arquivo"
                        : "arquivos"}
                    </span>

                    <span aria-hidden="true">
                      ·
                    </span>

                    <strong>
                      {formatarBytes(
                        modulo.armazenamento
                          ?.usadoBytes ??
                        0,
                      )}
                    </strong>
                  </div>

                </div>

                <ChevronRight
                  size={21}
                  className="module-card-arrow"
                />
              </button>
            );
          })}
        </section>

        <section
          className={`storage-card storage-card-${nivelArmazenamento}`}
        >
          <div className="storage-card-heading">
            <div className="storage-card-icon">
              <HardDrive size={20} />
            </div>

            <div>
              <span>Armazenamento</span>

              <h3>
                Seu espaço
              </h3>
            </div>
          </div>

          {carregandoArmazenamento ? (
            <p className="storage-loading">
              Consultando seu espaço...
            </p>
          ) : erroArmazenamento ? (
            <p className="storage-error">
              {erroArmazenamento}
            </p>
          ) : armazenamento ? (
            <>
              <div className="storage-summary">
                <div>
                  <span>
                    Plano atual
                  </span>

                  <strong>
                    {armazenamento.plano_nome ??
                      "Sem armazenamento"}
                  </strong>
                </div>

                <strong className="storage-percent">
                  {percentualUsado.toLocaleString(
                    "pt-BR",
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                  %
                </strong>
              </div>

              <div
                className="storage-progress"
                aria-label="Uso do armazenamento"
              >
                <div
                  className="storage-progress-fill"
                  style={{
                    width: `${percentualUsado}%`,
                  }}
                />
              </div>

              <div className="storage-usage">
                <strong>
                  {formatarBytes(
                    armazenamento.usado_bytes,
                  )}
                </strong>

                <span>
                  usados de{" "}
                  {formatarBytes(
                    armazenamento.limite_bytes,
                  )}
                </span>
              </div>

              <div className="storage-footer">
                <span>
                  {formatarBytes(
                    armazenamento.disponivel_bytes,
                  )}{" "}
                  disponíveis
                </span>

                {percentualUsado >= 90 && (
                  <strong>
                    Seu espaço está quase cheio
                  </strong>
                )}

                {percentualUsado >= 70 &&
                  percentualUsado < 90 && (
                    <strong>
                      Seu espaço está começando a ficar cheio
                    </strong>
                  )}

                <button
                  type="button"
                  className="storage-upgrade-button"
                  onClick={() =>
                    setUpgradeAberto(true)
                  }
                >
                  <Plus size={15} />

                  Gerenciar armazenamento
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="library-tip">
          <BookOpen size={18} />

          <div>
            <strong>
              Tudo continua conectado à Bíblia
            </strong>

            <p>
              Referências encontradas nos PDFs
              permanecem interativas em qualquer
              módulo.
            </p>
          </div>
        </section>
      </main>
      <StorageUpgradeModal
        aberto={upgradeAberto}
        armazenamento={armazenamento}
        onClose={() =>
          setUpgradeAberto(false)
        }
      />
    </div>
  );
}

export default BibliotecaPage;