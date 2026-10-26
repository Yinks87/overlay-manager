import { useEffect, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { api } from "../api";

/**
 * Einmalige Update-Prüfung beim App-Start (abhängig von den App-Einstellungen).
 * Gibt `{ available, installing }` zurück: `available` ist die gefundene Version,
 * solange sie nicht automatisch installiert wird.
 */
export function useStartupUpdate() {
  const [available, setAvailable] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(null);
  const started = useRef(false);
  const updateRef = useRef(null);

  async function install() {
    if (!updateRef.current) return;
    setError(null);
    setInstalling(true);
    try {
      await updateRef.current.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setInstalling(false);
      setError(`Update fehlgeschlagen: ${e}`);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const settings = await api.getAppSettings();
        if (!settings.autoCheckUpdates) return;
        const update = await check();
        if (!update) return;
        updateRef.current = update;
        if (settings.autoInstallUpdates) {
          setInstalling(true);
          await update.downloadAndInstall();
          await relaunch();
        } else {
          setAvailable(update.version);
        }
      } catch (e) {
        // Offline oder GitHub nicht erreichbar: beim Start nicht stören.
        console.warn("Update-Prüfung beim Start fehlgeschlagen:", e);
        setInstalling(false);
      }
    })();
  }, []);

  return {
    available,
    installing,
    error,
    install,
    dismiss: () => setAvailable(null),
    clearError: () => setError(null),
  };
}
