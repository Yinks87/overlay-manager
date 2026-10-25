import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { api } from "../api";

function Updates({ onError, autoUpdate, onAutoUpdateChange }) {
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | checking | uptodate | installing
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  async function search() {
    setStatus("checking");
    try {
      const found = await check();
      setUpdate(found);
      setStatus(found ? "idle" : "uptodate");
    } catch (e) {
      setStatus("idle");
      onError(`Update-Suche fehlgeschlagen: ${e}`);
    }
  }

  async function install() {
    setStatus("installing");
    let total = 0;
    let loaded = 0;
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        if (ev.event === "Progress") {
          loaded += ev.data.chunkLength;
          if (total) setProgress(Math.round((loaded / total) * 100));
        }
      });
      await relaunch();
    } catch (e) {
      setStatus("idle");
      setProgress(null);
      onError(`Update fehlgeschlagen: ${e}`);
    }
  }

  return (
    <section className="group">
      <h3>Updates</h3>
      <p className="hint">Installierte Version: {version || "…"}</p>
      {update && (
        <p>
          Version <strong>{update.version}</strong> ist verfügbar.
          {update.body && <span className="hint"> {update.body}</span>}
        </p>
      )}
      {status === "uptodate" && <p className="hint">Du verwendest die neueste Version.</p>}
      {status === "installing" && (
        <p className="hint">Lädt und installiert{progress !== null ? ` … ${progress} %` : " …"}</p>
      )}
      <div>
        {update ? (
          <button className="btn primary" onClick={install} disabled={status === "installing"}>
            Jetzt aktualisieren und neu starten
          </button>
        ) : (
          <button className="btn" onClick={search} disabled={status === "checking"}>
            {status === "checking" ? "Sucht …" : "Nach Updates suchen"}
          </button>
        )}
      </div>

      <label className="switch-row">
        <span className="switch-text">
          <span className="switch-label">Beim Start der App nach Updates suchen</span>
          <span className="hint">
            Prüft einmalig beim Start, ob auf GitHub eine neuere Version verfügbar ist, und zeigt dann einen Hinweis.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={autoUpdate?.check ?? false}
          disabled={!autoUpdate}
          onChange={(e) =>
            onAutoUpdateChange({
              check: e.target.checked,
              install: e.target.checked && autoUpdate.install,
            })
          }
        />
      </label>
      <label className="switch-row">
        <span className="switch-text">
          <span className="switch-label">Updates automatisch installieren</span>
          <span className="hint">
            Gefundene Updates werden beim Start ohne Rückfrage heruntergeladen und installiert; die App startet danach neu. Geöffnete Overlays werden dabei kurz geschlossen und starten wieder mit. Setzt die automatische Suche voraus.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={autoUpdate?.install ?? false}
          disabled={!autoUpdate?.check}
          onChange={(e) => onAutoUpdateChange({ check: true, install: e.target.checked })}
        />
      </label>
    </section>
  );
}

const OPTIONS = [
  {
    value: "exit",
    label: "App beenden",
    hint: "Schließt das Dashboard und beendet die App samt aller Overlays.",
  },
  {
    value: "minimize",
    label: "In den Tray minimieren",
    hint: "Das Dashboard verschwindet aus der Taskleiste und läuft als Symbol im Infobereich weiter, die Overlays laufen weiter. Klick auf das Symbol öffnet das Dashboard, per Rechtsklick lässt sich die App beenden.",
  },
];

export default function SettingsPage({ onError }) {
  const [closeBehavior, setCloseBehavior] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(null); // { check, install }

  useEffect(() => {
    api
      .getAppSettings()
      .then((s) => {
        setCloseBehavior(s.closeBehavior);
        setAutoUpdate({ check: s.autoCheckUpdates, install: s.autoInstallUpdates });
      })
      .catch((e) => onError(String(e)));
  }, [onError]);

  async function changeAutoUpdate(next) {
    const previous = autoUpdate;
    setAutoUpdate(next);
    try {
      await api.setUpdateSettings(next.check, next.install);
    } catch (e) {
      setAutoUpdate(previous);
      onError(String(e));
    }
  }

  async function choose(value) {
    const previous = closeBehavior;
    setCloseBehavior(value);
    try {
      await api.setCloseBehavior(value);
    } catch (e) {
      setCloseBehavior(previous);
      onError(String(e));
    }
  }

  return (
    <div className="editor">
      <header className="editor-head">
        <h2 className="page-title">App-Einstellungen</h2>
      </header>

      <section className="group">
        <h3>Beim Schließen des Dashboards</h3>
        {OPTIONS.map((o) => (
          <label className="switch-row" key={o.value}>
            <span className="switch-text">
              <span className="switch-label">{o.label}</span>
              <span className="hint">{o.hint}</span>
            </span>
            <input
              type="radio"
              name="close-behavior"
              className="radio"
              value={o.value}
              checked={closeBehavior === o.value}
              disabled={closeBehavior === null}
              onChange={() => choose(o.value)}
            />
          </label>
        ))}
      </section>

      <Updates onError={onError} autoUpdate={autoUpdate} onAutoUpdateChange={changeAutoUpdate} />
    </div>
  );
}
