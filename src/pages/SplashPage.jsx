import {
  useEffect,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import verboApresentacao from "../assets/verbo-apresentacao.png";

function SplashPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const destino =
    location.state?.destino &&
    location.state.destino.startsWith("/") &&
    !location.state.destino.startsWith("//")
      ? location.state.destino
      : "/";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(destino, {
        replace: true,
      });
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [destino, navigate]);

  return (
    <main className="splash-page">
      <img
        src={verboApresentacao}
        alt="VERBO - Organize, Ensine, Pregue - by Nethanel Tecnologia"
        className="splash-logo"
      />
    </main>
  );
}

export default SplashPage;