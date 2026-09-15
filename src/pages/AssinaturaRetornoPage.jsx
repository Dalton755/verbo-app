import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import {
  useAuth,
} from "../contexts/AuthContext";

function esperar(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms),
  );
}

function AssinaturaRetornoPage() {
  const navigate =
    useNavigate();

  const {
    user,
    loading,
  } = useAuth();

  const [
    estado,
    setEstado,
  ] = useState(
    "VERIFICANDO",
  );

  const [
    armazenamento,
    setArmazenamento,
  ] = useState(null);

  const [
    mensagem,
    setMensagem,
  ] = useState(
    "Estamos confirmando sua assinatura.",
  );


  useEffect(() => {
    if (loading) {
      return;
    }


    if (!user) {
      setEstado(
        "SEM_SESSAO",
      );

      setMensagem(
        "Entre na sua conta para concluir a confirmação da assinatura.",
      );

      return;
    }


    let cancelado =
      false;


    async function consultarArmazenamento() {
      const {
        data,
        error,
      } =
        await supabase
          .schema(
            "biblia_slides",
          )
          .rpc(
            "meu_armazenamento",
          )
          .single();


      if (error) {
        console.error(
          "Erro ao consultar armazenamento:",
          error,
        );

        return null;
      }


      return data;
    }


    async function reconciliar() {
      try {
        const {
          error,
        } =
          await supabase
            .functions
            .invoke(
              "reconciliar-assinatura-armazenamento",
            );


        if (error) {
          console.warn(
            "Reconciliação da assinatura ainda não concluída:",
            error,
          );
        }
      } catch (
      error
      ) {
        console.warn(
          "Erro ao reconciliar assinatura:",
          error,
        );
      }
    }


    async function verificar() {
      setEstado(
        "VERIFICANDO",
      );

      setMensagem(
        "Estamos confirmando sua assinatura.",
      );


      /*
       * O webhook normalmente já terá
       * atualizado tudo quando o usuário
       * voltar do Mercado Pago.
       *
       * Ainda assim, aguardamos alguns
       * segundos para cobrir atrasos de
       * processamento.
       */
      for (
        let tentativa = 1;
        tentativa <= 10;
        tentativa += 1
      ) {
        if (cancelado) {
          return;
        }


        const resultado =
          await consultarArmazenamento();


        if (cancelado) {
          return;
        }


        if (
          resultado
            ?.upgrade_ativo ===
          true
        ) {
          setArmazenamento(
            resultado,
          );

          setEstado(
            "CONFIRMADO",
          );

          setMensagem(
            "Seu novo espaço já está disponível.",
          );

          return;
        }


        /*
         * Na primeira tentativa também
         * sincronizamos o estado do
         * preapproval diretamente com MP.
         */
        if (
          tentativa === 1
        ) {
          await reconciliar();
        }


        if (
          tentativa < 10
        ) {
          setMensagem(
            "Pagamento recebido. Estamos finalizando a ativação do seu espaço.",
          );

          await esperar(
            2000,
          );
        }
      }


      if (cancelado) {
        return;
      }


      /*
       * Não tratamos atraso como falha
       * definitiva. O webhook pode terminar
       * depois que esta tela carregar.
       */
      setEstado(
        "PROCESSANDO",
      );

      setMensagem(
        "Sua assinatura está sendo processada. Você pode entrar na biblioteca e atualizar a página em alguns instantes.",
      );
    }


    verificar();


    return () => {
      cancelado =
        true;
    };
  }, [
    user,
    loading,
  ]);


  const confirmado =
    estado ===
    "CONFIRMADO";


  return (
    <main className="subscription-return-page">
      <section className="subscription-return-card">

        <div
          className={
            confirmado
              ? "subscription-return-icon subscription-return-icon-success"
              : estado ===
                "SEM_SESSAO"
                ? "subscription-return-icon subscription-return-icon-warning"
                : "subscription-return-icon"
          }
        >
          {confirmado ? (
            <CheckCircle2
              size={30}
            />
          ) : estado ===
            "SEM_SESSAO" ? (
            <TriangleAlert
              size={28}
            />
          ) : (
            <LoaderCircle
              size={28}
              className={
                estado ===
                  "VERIFICANDO"
                  ? "subscription-return-spinner"
                  : ""
              }
            />
          )}
        </div>


        <span className="subscription-return-kicker">
          Bíblia Slides
        </span>


        <h1>
          {confirmado
            ? "Assinatura confirmada"
            : estado ===
              "SEM_SESSAO"
              ? "Entre na sua conta"
              : estado ===
                "PROCESSANDO"
                ? "Ativação em andamento"
                : "Confirmando assinatura"}
        </h1>


        <p>
          {mensagem}
        </p>


        {confirmado &&
          armazenamento && (
            <div className="subscription-return-plan">
              <span>
                Plano ativo
              </span>

              <strong>
                {
                  armazenamento
                    .plano_nome
                }
              </strong>

              <small>
                {
                  armazenamento
                    .disponivel_bytes
                    ? `${(
                      Number(
                        armazenamento
                          .disponivel_bytes,
                      ) /
                      1024 /
                      1024
                    ).toFixed(
                      1,
                    )} MB disponíveis`
                    : ""
                }
              </small>
            </div>
          )}


        {estado ===
          "SEM_SESSAO" ? (
          <button
            type="button"
            className="subscription-return-primary"
            onClick={() => {
              const retorno =
                `${window.location.pathname}${window.location.search}`;

              navigate(
                `/login?redirect=${encodeURIComponent(
                  retorno,
                )}`,
              );
            }}
          >
            <LogIn
              size={17}
            />

            Entrar
          </button>
        ) : (
          <button
            type="button"
            className="subscription-return-primary"
            onClick={() =>
              navigate(
                "/",
                {
                  replace:
                    true,
                },
              )
            }
          >
            Ir para minha biblioteca

            <ArrowRight
              size={17}
            />
          </button>
        )}

      </section>
    </main>
  );
}

export default AssinaturaRetornoPage;
