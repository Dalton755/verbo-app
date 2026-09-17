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
  ] = useState(
    navigator.onLine,
  );

  useEffect(() => {
    function ficouOnline() {
      setOnline(true);
    }

    function ficouOffline() {
      setOnline(false);
    }

    window.addEventListener(
      "online",
      ficouOnline,
    );

    window.addEventListener(
      "offline",
      ficouOffline,
    );

    return () => {
      window.removeEventListener(
        "online",
        ficouOnline,
      );

      window.removeEventListener(
        "offline",
        ficouOffline,
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
      <WifiOff
        size={16}
      />

      <span>
        Você está offline
      </span>
    </div>
  );
}

export default OfflineStatus;