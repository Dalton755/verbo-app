import {
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";

import {
  useNavigate,
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
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const {
    entrarComGoogle,
    entrar,
    recuperarSenha,
  } = useAuth();

  const [
    formularioEmailAberto,
    setFormularioEmailAberto,
  ] = useState(false);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    senha,
    setSenha,
  ] = useState("");

  const [
    mostrarSenha,
    setMostrarSenha,
  ] = useState(false);

  const [
    acaoEmAndamento,
    setAcaoEmAndamento,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
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

  const processando =
    Boolean(
      acaoEmAndamento,
    );

  async function entrarGoogle() {
    setErro("");
    setSucesso("");
    setAcaoEmAndamento(
      "google",
    );

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

      setAcaoEmAndamento("");
    }
  }

  async function entrarEmail(
    event,
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setAcaoEmAndamento(
      "email",
    );

    try {
      const { error } =
        await entrar(
          email.trim(),
          senha,
        );

      if (error) {
        throw error;
      }

      navigate(
        "/",
        {
          replace: true,
        },
      );
    } catch (error) {
      console.error(error);

      if (
        error?.message ===
        "Invalid login credentials"
      ) {
        setErro(
          "E-mail ou senha incorretos.",
        );
      } else {
        setErro(
          "Não conseguimos entrar agora. Confira os dados e tente novamente.",
        );
      }
    } finally {
      setAcaoEmAndamento("");
    }
  }

  async function enviarRecuperacao() {
    setErro("");
    setSucesso("");

    const emailInformado =
      email.trim();

    if (!emailInformado) {
      setErro(
        "Informe seu e-mail para recuperar a senha.",
      );

      return;
    }

    setAcaoEmAndamento(
      "recuperacao",
    );

    try {
      const { error } =
        await recuperarSenha(
          emailInformado,
        );

      if (error) {
        throw error;
      }

      setSucesso(
        "Enviamos um link para redefinir sua senha. Confira também a pasta de spam.",
      );
    } catch (error) {
      console.error(error);

      setErro(
        "Não foi possível enviar o link de recuperação. Tente novamente.",
      );
    } finally {
      setAcaoEmAndamento("");
    }
  }

  function alternarFormularioEmail() {
    setErro("");
    setSucesso("");

    setFormularioEmailAberto(
      (atual) => !atual,
    );
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

        {sucesso && (
          <div className="auth-message auth-success">
            {sucesso}
          </div>
        )}

        <button
          type="button"
          className="primary-button auth-submit auth-google-button"
          onClick={entrarGoogle}
          disabled={processando}
        >
          <span
            aria-hidden="true"
            className="auth-google-icon"
          >
            G
          </span>

          {acaoEmAndamento ===
          "google"
            ? "Abrindo Google..."
            : "Continuar com Google"}
        </button>

        <div className="auth-login-divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="auth-email-toggle"
          onClick={
            alternarFormularioEmail
          }
          aria-expanded={
            formularioEmailAberto
          }
          disabled={processando}
        >
          <LogIn size={18} />

          <span>
            {formularioEmailAberto
              ? "Ocultar entrada por e-mail"
              : "Entrar com e-mail e senha"}
          </span>
        </button>

        {formularioEmailAberto && (
          <form
            className="auth-form auth-email-form"
            onSubmit={entrarEmail}
          >
            <label>
              E-mail

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="seu@email.com"
                required
                autoComplete="email"
                inputMode="email"
                disabled={processando}
              />
            </label>

            <label>
              Senha

              <div className="auth-password-field">
                <input
                  type={
                    mostrarSenha
                      ? "text"
                      : "password"
                  }
                  value={senha}
                  onChange={(event) =>
                    setSenha(
                      event.target.value,
                    )
                  }
                  placeholder="Sua senha"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  disabled={processando}
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() =>
                    setMostrarSenha(
                      (atual) =>
                        !atual,
                    )
                  }
                  aria-label={
                    mostrarSenha
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                  title={
                    mostrarSenha
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                  disabled={processando}
                >
                  {mostrarSenha ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </label>

            <div className="auth-email-actions">
              <button
                type="button"
                className="auth-forgot-password"
                onClick={
                  enviarRecuperacao
                }
                disabled={processando}
              >
                {acaoEmAndamento ===
                "recuperacao"
                  ? "Enviando link..."
                  : "Esqueci minha senha"}
              </button>
            </div>

            <button
              type="submit"
              className="primary-button auth-submit"
              disabled={processando}
            >
              {acaoEmAndamento ===
              "email"
                ? "Entrando..."
                : "Entrar"}
            </button>
          </form>
        )}

        <p className="auth-footer auth-login-note">
          Acesso rápido. Nenhum dado de pagamento será solicitado agora.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
