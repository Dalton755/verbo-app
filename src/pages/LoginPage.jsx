import {
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function normalizarModulo(
  valor,
) {
  const codigo = String(
    valor ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    [
      "EBD",
      "SERMOES",
      "LIVROS",
    ].includes(codigo)
  ) {
    return codigo;
  }

  return "TODOS";
}

function LoginPage() {
  const [
    searchParams,
  ] = useSearchParams();

  const {
    entrarComGoogle,
  } = useAuth();

  const [
    enviando,
    setEnviando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const modulo =
    normalizarModulo(
      searchParams.get("modulo"),
    );

  const sessaoSubstituida =
    searchParams.get("motivo") ===
    "sessao-substituida";

  const textos = {
    EBD: {
      kicker: "VERBO EBD",
      titulo:
        "Sua EBD organizada",
      descricao:
        "Trimestres, aulas e apresentações bíblicas em um só lugar.",
    },

    SERMOES: {
      kicker: "VERBO Sermões",
      titulo:
        "Seus sermões organizados",
      descricao:
        "Prepare, organize e pregue com seus materiais sempre acessíveis.",
    },

    LIVROS: {
      kicker: "VERBO Livros",
      titulo:
        "Sua biblioteca cristã",
      descricao:
        "Organize seus livros e PDFs para estudar onde estiver.",
    },

    TODOS: {
      kicker: "VERBO",
      titulo:
        "Organize. Ensine. Pregue.",
      descricao:
        "Sua EBD, seus sermões e seus livros em uma biblioteca simples e inteligente.",
    },
  };

  const texto =
    textos[modulo];

  async function entrarGoogle() {
    setErro("");
    setEnviando(true);

    try {
      const { error } =
        await entrarComGoogle(
          modulo,
        );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(error);

      setErro(
        "Não conseguimos acessar com o Google. Tente novamente.",
      );

      setEnviando(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand auth-brand-verbo">
          <img
            src={verboLogoHorizontal}
            alt="VERBO"
            className="auth-brand-logo"
          />
        </div>

        <div className="auth-heading">
          <span className="app-kicker">
            {texto.kicker}
          </span>

          <h1>
            {texto.titulo}
          </h1>

          <p>
            {texto.descricao}
          </p>
        </div>

        {sessaoSubstituida && (
          <div className="auth-message auth-error">
            Sua conta foi acessada em outro dispositivo.
            Entre novamente para continuar neste aparelho.
          </div>
        )}

        {erro && (
          <div className="auth-message auth-error">
            {erro}
          </div>
        )}

        <button
          type="button"
          className="primary-button auth-submit"
          onClick={entrarGoogle}
          disabled={enviando}
          style={{
            width: "100%",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "#fff",
              color: "#4285f4",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
            }}
          >
            G
          </span>

          {enviando
            ? "Abrindo Google..."
            : "Continuar com Google"}
        </button>

        <p
          className="auth-footer"
          style={{
            marginTop: "18px",
            opacity: 0.7,
          }}
        >
          Acesso rápido. Nenhum dado de pagamento será solicitado agora.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
