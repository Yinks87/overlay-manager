import { useEffect, useState } from "react";
import { api } from "../api";

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

  useEffect(() => {
    api
      .getAppSettings()
      .then((s) => setCloseBehavior(s.closeBehavior))
      .catch((e) => onError(String(e)));
  }, [onError]);

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
    </div>
  );
}
