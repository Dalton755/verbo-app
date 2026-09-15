import { useState } from "react";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function RedefinirSenhaPage() {
  const navigate = useNavigate();

  const {
    user,
    loading,
    atualizarSenha,
    sair,
  } = useAuth();

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] =
    useState("");

  const [
    mostrarSenha,
    setMostrarSenha,
  ] = useState(false);

  const [
    mostrarConfirmacao,
    setMostrarConfirmacao,
  ] = useState(false);

  const [enviando, setEnviando] =
    useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] =
    useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    if (senha.length < 6) {
      setErro(
        "A nova senha precisa ter pelo menos 6 caracteres.",
      );
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);

    try {
      const { error } =
        await atualizarSenha(senha);

      if (error) {
        throw error;
      }

      setSucesso(
        "Senha alterada com sucesso.",
      );

      setTimeout(async () => {
        await sair();

        navigate("/login", {
          replace: true,
        });
      }, 1200);
    } catch (error) {
      console.error(error);

      setErro(
        "Não foi possível alterar sua senha. Solicite um novo link de recuperação.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-dot" />

        <p>Validando seu acesso...</p>
      </div>
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
            Recuperação de acesso
          </span>

          <h1>Crie uma nova senha</h1>

          <p>
            Escolha uma nova senha para acessar
            novamente sua biblioteca.
          </p>
        </div>

        {!user ? (
          <>
            <div className="auth-message auth-error">
              Este link de recuperação é inválido
              ou expirou.
            </div>

            <button
              type="button"
              className="primary-button auth-submit"
              onClick={() =>
                navigate("/login", {
                  replace: true,
                })
              }
            >
              Voltar para o login

              <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
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
              <label>
                Nova senha

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
                    placeholder="Digite a nova senha"
                    required
                    minLength={6}
                    autoComplete="new-password"
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
                  >
                    {mostrarSenha ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </label>

              <label>
                Confirmar nova senha

                <div className="auth-password-field">
                  <input
                    type={
                      mostrarConfirmacao
                        ? "text"
                        : "password"
                    }
                    value={confirmacao}
                    onChange={(event) =>
                      setConfirmacao(
                        event.target.value,
                      )
                    }
                    onFocus={(event) => {
                      const campo =
                        event.currentTarget;

                      window.setTimeout(() => {
                        campo.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }, 250);
                    }}
                    placeholder="Digite novamente"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() =>
                      setMostrarConfirmacao(
                        (atual) => !atual,
                      )
                    }
                    aria-label={
                      mostrarConfirmacao
                        ? "Ocultar confirmação da senha"
                        : "Mostrar confirmação da senha"
                    }
                  >
                    {mostrarConfirmacao ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </label>

              {erro && (
                <div className="auth-message auth-error">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                className="primary-button auth-submit"
                disabled={
                  enviando ||
                  Boolean(sucesso)
                }
              >
                {enviando
                  ? "Alterando..."
                  : sucesso
                    ? "Senha alterada"
                    : "Salvar nova senha"}

                {!enviando && !sucesso && (
                  <ArrowRight size={18} />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default RedefinirSenhaPage;