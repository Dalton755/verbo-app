import {
  useEffect,
  useState,
} from "react";

import {
  WifiOff,
} from "lucide-react";

function OfflineStatus() {
  const [
    online,
    setOnline,
  ] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function verificarConexao() {
      if (!navigator.onLine) {
        if (ativo) {
          setOnline(false);
        }

        return;
      }

      try {
        const resposta =
          await fetch(
            `/manifest.webmanifest?__online_check=${Date.now()}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        if (ativo) {
          setOnline(
            resposta.ok,
          );
        }
      } catch {
        if (ativo) {
          setOnline(false);
        }
      }
    }

    function mudouConexao() {
      verificarConexao();
    }

    window.addEventListener(
      "online",
      mudouConexao,
    );

    window.addEventListener(
      "offline",
      mudouConexao,
    );

    verificarConexao();

    const intervalo =
      window.setInterval(
        verificarConexao,
        10000,
      );

    return () => {
      ativo = false;

      window.clearInterval(
        intervalo,
      );

      window.removeEventListener(
        "online",
        mudouConexao,
      );

      window.removeEventListener(
        "offline",
        mudouConexao,
      );
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div
      className="offline-status"
      role="status"
    >
      <WifiOff size={16} />

      <span>
        Você está offline
      </span>
    </div>
  );
}

export default OfflineStatus;