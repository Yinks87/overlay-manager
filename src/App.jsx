import { useState } from "react";
import { useOverlays } from "./hooks/useOverlays";
import DashboardPage from "./components/DashboardPage";
import OverlaysPage from "./components/OverlaysPage";
import SettingsPage from "./components/SettingsPage";
import { useStartupUpdate } from "./hooks/useStartupUpdate";
import "./App.css";

const PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "overlays", label: "Overlays" },
  { id: "settings", label: "Einstellungen" },
];

export default function App() {
  const o = useOverlays();
  const startupUpdate = useStartupUpdate();
  const [page, setPage] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);

  // Auswahl (z. B. aus der Monitorübersicht) öffnet die Overlay-Seite mit dem Overlay.
  function openOverlayPage(id) {
    setSelectedId(id);
    setPage("overlays");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="brand">Overlay Manager</h1>
        <nav className="nav" aria-label="Hauptmenü">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={page === p.id ? "nav-btn active" : "nav-btn"}
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="stage">
        {(startupUpdate.installing || startupUpdate.available || startupUpdate.error || o.error) && (
          <div className="banners">
            {startupUpdate.installing && (
              <div className="banner info" role="status">
                <span>Update wird heruntergeladen und installiert … Die App startet gleich neu.</span>
              </div>
            )}
            {startupUpdate.available && !startupUpdate.installing && (
              <div className="banner info" role="status">
                <span>Version {startupUpdate.available} ist verfügbar.</span>
                <span className="banner-actions">
                  <button className="btn primary" onClick={startupUpdate.install}>
                    Jetzt aktualisieren
                  </button>
                  <button className="btn ghost" onClick={startupUpdate.dismiss}>
                    Später
                  </button>
                </span>
              </div>
            )}
            {startupUpdate.error && (
              <div className="banner" role="alert">
                <span>{startupUpdate.error}</span>
                <button className="btn ghost" onClick={startupUpdate.clearError}>
                  Schließen
                </button>
              </div>
            )}
            {o.error && (
              <div className="banner" role="alert">
                <span>{o.error}</span>
                <button className="btn ghost" onClick={() => o.setError(null)}>
                  Schließen
                </button>
              </div>
            )}
          </div>
        )}

        {page === "dashboard" && (
          <div className="page">
            <DashboardPage
              overlays={o.overlays}
              openIds={o.openIds}
              maximizedIds={o.maximizedIds}
              selectedId={selectedId}
              onSelect={openOverlayPage}
              onSetOpen={o.setOpen}
              onToggle={o.toggleOpen}
              onMaximize={o.toggleMaximized}
              onLocked={o.setLocked}
              onAudio={o.setAudio}
              onDuplicate={o.duplicate}
            />
          </div>
        )}
        {page === "overlays" && <OverlaysPage o={o} selectedId={selectedId} onSelect={setSelectedId} />}
        {page === "settings" && (
          <div className="page">
            <SettingsPage onError={o.setError} />
          </div>
        )}
      </main>
    </div>
  );
}
