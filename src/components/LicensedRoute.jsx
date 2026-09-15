import { Navigate } from "react-router-dom";
import { useLicense } from "../contexts/LicenseContext";

function LicensedRoute({ children }) {
  const {
    temLicenca,
    carregandoLicenca,
  } = useLicense();

  if (carregandoLicenca) {
    return (
      <div className="loading-page">
        <div className="loading-dot" />

        <p>Verificando seu acesso...</p>
      </div>
    );
  }

  if (!temLicenca) {
    return (
      <Navigate
        to="/acesso"
        replace
      />
    );
  }

  return children;
}

export default LicensedRoute;