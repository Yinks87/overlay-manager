import { useState } from "react";
import { useOverlays } from "./hooks/useOverlays";
import OverlayList from "./components/OverlayList";
import OverlayEditor from "./components/OverlayEditor";
import ScreenMap from "./components/ScreenMap";
import SettingsPage from "./components/SettingsPage";
import "./App.css";

export default function App() {
  const o = useOverlays();
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const selected = o.overlays.find((x) => x.id === selectedId) ?? null;

  function handleSelect(id) {
    setSelectedId(id);
    setShowSettings(false);
  }

  async function handleCreate() {
    const created = await o.create();
    if (created) handleSelect(created.id);
  }

  async function handleDelete(id) {
    await o.remove(id);
    setSelectedId(null);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-head">
          <h1>Overlays</h1>
          <button className="btn primary" onClick={handleCreate}>
            Neues Overlay
          </button>
        </header>

        <OverlayList
          overlays={o.overlays}
          openIds={o.openIds}
          selectedId={selectedId}
          onSelect={handleSelect}
          onToggle={o.toggleOpen}
          maximizedIds={o.maximizedIds}
          onMaximize={o.toggleMaximized}
        />

        <ScreenMap
          overlays={o.overlays}
          openIds={o.openIds}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <button
          className={showSettings ? "btn settings-btn active" : "btn settings-btn"}
          onClick={() => setShowSettings(true)}
        >
          Einstellungen
        </button>
      </aside>

      <main className="stage">
        {o.error && (
          <div className="banner" role="alert">
            <span>{o.error}</span>
            <button className="btn ghost" onClick={() => o.setError(null)}>
              Schließen
            </button>
          </div>
        )}

        {showSettings ? (
          <SettingsPage onError={o.setError} />
        ) : selected ? (
          <OverlayEditor
            key={selected.id}
            overlay={selected}
            isOpen={o.openIds.includes(selected.id)}
            onSave={(input) => o.save(selected.id, input)}
            onDelete={() => handleDelete(selected.id)}
            onToggleOpen={() => o.toggleOpen(selected.id)}
            isMaximized={o.maximizedIds.includes(selected.id)}
            onMaximize={() => o.toggleMaximized(selected.id)}
            onAudio={(v, m) => o.setAudio(selected.id, v, m)}
            onLocked={(l) => o.setLocked(selected.id, l)}
          />
        ) : (
          <div className="empty">
            <h2>{o.overlays.length ? "Overlay auswählen" : "Noch kein Overlay angelegt"}</h2>
            <p>
              {o.overlays.length
                ? "Wähle links ein Overlay oder in der Bildschirmübersicht ein Rechteck."
                : "Lege ein Overlay an, trage eine URL ein und öffne es als eigenes, durchklickbares Fenster."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
