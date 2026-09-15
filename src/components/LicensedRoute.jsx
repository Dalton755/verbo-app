import { Navigate } from "react-router-dom";
import { useLicense } from "../contexts/LicenseContext";

function LicensedRoute({ children }) {
  const {
    temLicenca,
    carregandoLicenca,
  } = useLicense();

  /*
   * Na primeira verificação do acesso,
   * ainda não sabemos se o usuário pode
   * entrar no app. Nesse caso mostramos
   * a tela de carregamento.
   *
   * Depois que o usuário já possui acesso,
   * novas verificações acontecem em segundo
   * plano sem desmontar a página atual.
   *
   * Isso é especialmente importante no
   * celular: ao voltar do seletor de arquivos,
   * uma atualização da sessão pode disparar
   * nova consulta de licença. Se desmontarmos
   * a página nesse momento, o navegador perde
   * o arquivo escolhido pelo usuário.
   */
  if (
    carregandoLicenca &&
    !temLicenca
  ) {
    return (
      <div className="loading-page">
        <div className="loading-dot" />

        <p>
          Verificando seu acesso...
        </p>
      </div>
    );
  }

  /*
   * Se a consulta terminou e o usuário
   * realmente não possui acesso, envia
   * para a página de adesão.
   */
  if (
    !carregandoLicenca &&
    !temLicenca
  ) {
    return (
      <Navigate
        to="/acesso"
        replace
      />
    );
  }

  /*
   * Se já sabemos que existe acesso,
   * mantemos a tela montada mesmo durante
   * verificações posteriores da licença.
   */
  return children;
}

export default LicensedRoute;