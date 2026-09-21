import { useLicense } from "../contexts/LicenseContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

function AcessoPage() {

  const navigate = useNavigate();


  const {
    temLicenca,
    carregandoLicenca,
    erroLicenca,
    recarregarLicenca,
    acessoVitalicio,
  } = useLicense();




  const { sair } = useAuth();

  const [abrindoCheckout, setAbrindoCheckout] =
    useState(false);

  const [erroCheckout, setErroCheckout] =
    useState("");

  const statusPagamento =
    new URLSearchParams(
      window.location.search
    ).get("pagamento");

  const motivoOferta =
    new URLSearchParams(
      window.location.search
    ).get("motivo");

  const ofertaPorLimiteDemo =
    motivoOferta ===
    "limite-demo";

  const retornoPagamento =
    statusPagamento ===
    "aprovado" ||
    statusPagamento ===
    "pendente" ||
    statusPagamento ===
    "falhou";

  useEffect(() => {
    const parametros =
      new URLSearchParams(
        window.location.search
      );

    const statusRetorno =
      parametros.get("pagamento");

    const voltouDoPagamento =
      statusRetorno === "aprovado" ||
      statusRetorno === "pendente";

    if (!voltouDoPagamento) {
      return;
    }

    let cancelado = false;
    let temporizador = null;
    let tentativas = 0;

    async function verificarPagamento() {
      if (cancelado) {
        return;
      }

      tentativas += 1;

      try {
        const { data, error } =
          await supabase.functions.invoke(
            "reconciliar-pagamento"
          );

        if (error) {
          console.error(
            "Erro ao reconciliar pagamento:",
            error
          );
        }

        await recarregarLicenca();

        if (
          data?.liberado ||
          data?.semPendente
        ) {
          return;
        }
      } catch (error) {
        console.error(
          "Erro ao verificar pagamento:",
          error
        );
      }

      if (
        !cancelado &&
        tentativas < 15
      ) {
        temporizador = setTimeout(
          verificarPagamento,
          2000
        );
      }
    }

    verificarPagamento();

    return () => {
      cancelado = true;

      if (temporizador) {
        clearTimeout(temporizador);
      }
    };
  }, []);

  async function abrirCheckout() {
    setAbrindoCheckout(true);
    setErroCheckout("");

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "criar-checkout"
        );

      if (error) {
        throw error;
      }

      if (
        !data?.ok ||
        !data?.checkoutUrl
      ) {
        throw new Error(
          data?.erro ||
          "Checkout indisponível."
        );
      }

      window.location.assign(
        data.checkoutUrl
      );
    } catch (error) {
      console.error(
        "Erro ao abrir checkout:",
        error
      );

      setErroCheckout(
        "Não foi possível abrir o pagamento. Tente novamente."
      );

      setAbrindoCheckout(false);
    }
  }

  if (carregandoLicenca) {
    return (
      <div className="loading-page">
        <div className="loading-dot" />
        <p>Verificando seu acesso...</p>
      </div>
    );
  }

  if (acessoVitalicio) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    temLicenca &&
    !ofertaPorLimiteDemo &&
    !retornoPagamento
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <header className="access-header">
          <p className="access-kicker">
            Apresentações Bíblicas
          </p>

          <h1>
            Seu conteúdo bíblico,
            organizado em um só lugar.
          </h1>

          <p className="access-subtitle">
            Organize EBD, sermões, livros,
            estudos e apresentações em um
            ambiente simples e acessível.
          </p>
        </header>

        {statusPagamento === "aprovado" && (
          <div className="access-status access-status-success">
            <strong>
              Pagamento recebido
            </strong>

            <span>
              Estamos confirmando sua licença.
              Seu acesso será liberado
              automaticamente.
            </span>
          </div>
        )}

        {statusPagamento === "pendente" && (
          <div className="access-status access-status-pending">
            <strong>
              Pagamento em processamento
            </strong>

            <span>
              Assim que o Mercado Pago confirmar
              o pagamento, seu acesso será
              liberado automaticamente.
            </span>
          </div>
        )}

        {statusPagamento === "falhou" && (
          <div className="access-status access-status-error">
            <strong>
              Pagamento não concluído
            </strong>

            <span>
              Você pode tentar novamente.
              Nenhuma licença foi ativada.
            </span>
          </div>
        )}

        {!statusPagamento && (
          <div className="access-status access-status-neutral">
            <strong>
              {ofertaPorLimiteDemo
                ? "Você concluiu o teste deste módulo"
                : ofertaPorDemoExpirada
                  ? "Seus 7 dias de demonstração terminaram"
                  : "Libere o VERBO completo"}
            </strong>

            <span>
              {ofertaPorLimiteDemo
                ? "Na demonstração você pode importar 1 arquivo em cada módulo. Para importar outro arquivo neste módulo, libere o VERBO Vitalício."
                : ofertaPorDemoExpirada
                  ? "Seu período gratuito de 7 dias chegou ao fim. Libere o VERBO Vitalício para continuar usando seus materiais."
                  : "Tenha acesso vitalício ao VERBO com 25 MB de armazenamento incluídos."}
            </span>
          </div>
        )}

        <div className="access-features">
          <div className="access-feature">
            <span className="access-check">
              ✓
            </span>

            <div>
              <strong>
                EBD e apresentações
              </strong>

              <small>
                Organize aulas e materiais
                para apresentação.
              </small>
            </div>
          </div>

          <div className="access-feature">
            <span className="access-check">
              ✓
            </span>

            <div>
              <strong>
                Sermões organizados
              </strong>

              <small>
                Mantenha seus esboços e estudos
                sempre disponíveis.
              </small>
            </div>
          </div>

          <div className="access-feature">
            <span className="access-check">
              ✓
            </span>

            <div>
              <strong>
                Biblioteca pessoal
              </strong>

              <small>
                Livros, destaques, notas e
                marcadores em um só ambiente.
              </small>
            </div>
          </div>

          <div className="access-feature">
            <span className="access-check">
              ✓
            </span>

            <div>
              <strong>
                Acesso vitalício
              </strong>

              <small>
                Sem mensalidade e sem cobrança
                recorrente.
              </small>
            </div>
          </div>
        </div>

        <div className="access-feature">
          <span className="access-check">
            ✓
          </span>

          <div>
            <strong>
              25 MB incluídos
            </strong>

            <small>
              Espaço incluído no acesso
              vitalício. Se precisar de mais
              espaço no futuro, você poderá
              contratar separadamente.
            </small>
          </div>
        </div>

        <div className="access-price-box">
          <span>
            Pagamento único
          </span>

          <strong>
            R$ 9,90
          </strong>

          <small>
            VERBO Vitalício · 25 MB incluídos · Sem mensalidade
          </small>
        </div>

        {statusPagamento !== "aprovado" &&
          statusPagamento !== "pendente" && (
            <button
              className="access-primary-button"
              type="button"
              onClick={abrirCheckout}
              disabled={abrindoCheckout}
            >
              {abrindoCheckout
                ? "Abrindo pagamento..."
                : "Liberar VERBO Vitalício"}
            </button>
          )}

        {ofertaPorLimiteDemo && (
          <button
            className="access-secondary-button"
            type="button"
            onClick={() => navigate("/")}
          >
            Continuar minha demonstração
          </button>
        )}

        <button
          className="access-secondary-button"
          type="button"
          onClick={recarregarLicenca}
        >
          Verificar acesso
        </button>

        {erroCheckout && (
          <p className="access-error-message">
            {erroCheckout}
          </p>
        )}

        {erroLicenca && (
          <p className="access-error-message">
            {erroLicenca}
          </p>
        )}

        <p className="access-payment-note">
          Pagamento seguro processado pelo
          Mercado Pago.
        </p>

        <button
          className="access-logout-button"
          type="button"
          onClick={sair}
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}

export default AcessoPage;