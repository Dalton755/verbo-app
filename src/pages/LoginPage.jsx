import { useState } from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function LoginPage() {
  const navigate = useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const redirectInformado =
    searchParams.get(
      "redirect",
    );

  const destinoAposLogin =
    redirectInformado &&
      redirectInformado.startsWith("/") &&
      !redirectInformado.startsWith("//")
      ? redirectInformado
      : "/";

  const {
    entrar,
    cadastrar,
    recuperarSenha,
  } = useAuth();

  const [modo, setModo] = useState("login");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const cadastro = modo === "cadastro";

  async function handleSubmit(event) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setEnviando(true);

    try {
      if (cadastro) {
        if (!nome.trim()) {
          setErro("Informe seu nome para continuar.");
          return;
        }

        const { data, error } = await cadastrar(
          nome.trim(),
          email.trim(),
          senha,
        );

        if (error) {
          throw error;
        }

        if (data.session) {
          navigate(
            "/boas-vindas",
            {
              replace: true,
              state: {
                destino: destinoAposLogin,
              },
            },
          );

          return;
        }

        setSucesso(
          "Conta criada. Confira seu e-mail para confirmar seu acesso.",
        );

        return;
      }

      const { error } = await entrar(
        email.trim(),
        senha,
      );

      if (error) {
        throw error;
      }

      navigate(
        "/boas-vindas",
        {
          replace: true,
          state: {
            destino: destinoAposLogin,
          },
        },
      );
    } catch (error) {
      console.error(error);

      if (error.message === "Invalid login credentials") {
        setErro("E-mail ou senha incorretos.");
        return;
      }

      if (error.message?.includes("already registered")) {
        setErro("Este e-mail já possui uma conta.");
        return;
      }

      setErro(
        "Não conseguimos concluir agora. Confira os dados e tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function handleRecuperarSenha() {
    setErro("");
    setSucesso("");

    const emailInformado = email.trim();

    if (!emailInformado) {
      setErro(
        "Informe seu e-mail para recuperar a senha.",
      );
      return;
    }

    setEnviando(true);

    try {
      const { error } =
        await recuperarSenha(emailInformado);

      if (error) {
        throw error;
      }

      setSucesso(
        "Enviamos um link para redefinir sua senha. Confira sua caixa de entrada e também o spam.",
      );
    } catch (error) {
      console.error(error);

      setErro(
        "Não foi possível enviar o link de recuperação. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  function trocarModo() {
    setErro("");
    setSucesso("");

    setModo((atual) =>
      atual === "login" ? "cadastro" : "login",
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
            {cadastro
              ? "Comece gratuitamente"
              : "Bem-vindo"}
          </span>

          <h1>
            {cadastro
              ? "Crie sua biblioteca"
              : "Entre para acessar suas aulas"}
          </h1>

          <p>
            {cadastro
              ? "Você poderá importar até 3 arquivos gratuitamente e experimentar todos os recursos."
              : "Sua EBD, seus sermões e seus livros ficam organizados em uma única biblioteca."}
          </p>
        </div>

        {sucesso && (
          <div className="auth-message auth-success">
            <CheckCircle2 size={19} />

            <span>{sucesso}</span>
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          {cadastro && (
            <label>
              Nome

              <input
                type="text"
                value={nome}
                onChange={(event) =>
                  setNome(event.target.value)
                }
                placeholder="Como podemos chamar você?"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            E-mail

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="seu@email.com"
              required
              autoComplete="email"
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
                  setSenha(event.target.value)
                }
                placeholder={
                  cadastro
                    ? "Crie uma senha"
                    : "Sua senha"
                }
                required
                minLength={6}
                autoComplete={
                  cadastro
                    ? "new-password"
                    : "current-password"
                }
              />

              <button
                type="button"
                className="auth-password-toggle"
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() =>
                  setMostrarSenha(
                    (atual) => !atual,
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
              >
                {mostrarSenha ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </label>

          {!cadastro && (
            <p className="auth-footer">
              <button
                type="button"
                onClick={handleRecuperarSenha}
                disabled={enviando}
              >
                Esqueci minha senha
              </button>
            </p>
          )}

          {erro && (
            <div className="auth-message auth-error">
              {erro}
            </div>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={enviando}
          >
            {enviando
              ? "Aguarde..."
              : cadastro
                ? "Criar minha biblioteca"
                : "Entrar"}

            {!enviando && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="auth-footer">
          {cadastro
            ? "Já possui uma conta?"
            : "Ainda não tem acesso?"}

          {" "}

          <button
            type="button"
            onClick={trocarModo}
          >
            {cadastro ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
