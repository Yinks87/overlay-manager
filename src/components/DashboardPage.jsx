import { useMonitors } from "../hooks/useMonitors";
import ScreenMap from "./ScreenMap";

/** Startseite: alle Monitore mit den Positionen der Overlays. */
export default function DashboardPage({ overlays, openIds, selectedId, onSelect, onSetOpen }) {
  const monitors = useMonitors();
  const allIds = overlays.map((o) => o.id);

  return (
    <div className="page-content">
      <header className="editor-head">
        <h2 className="page-title">Dashboard</h2>
        <div className="head-actions">
          <button
            className="btn"
            disabled={!allIds.length || allIds.every((id) => openIds.includes(id))}
            onClick={() => onSetOpen(allIds, true)}
          >
            Alle öffnen
          </button>
          <button className="btn stop" disabled={!openIds.length} onClick={() => onSetOpen(allIds, false)}>
            Alle schließen
          </button>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <strong>{monitors.length}</strong>
          <span>Monitore</span>
        </div>
        <div className="stat">
          <strong>{overlays.length}</strong>
          <span>Overlays</span>
        </div>
        <div className="stat">
          <strong>{openIds.length}</strong>
          <span>geöffnet</span>
        </div>
      </div>

      <section className="group">
        <h3>Bildschirme und Overlays</h3>
        <ScreenMap
          monitors={monitors}
          overlays={overlays}
          openIds={openIds}
          selectedId={selectedId}
          onSelect={onSelect}
          maxHeight={460}
        />
        <p className="hint legend">
          <span className="swatch open" /> geöffnet
          <span className="swatch" /> geschlossen
          · Ein Klick auf ein Overlay öffnet seine Einstellungen.
        </p>
      </section>
    </div>
  );
}
