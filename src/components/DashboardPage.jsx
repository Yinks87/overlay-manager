import { useCallback, useState } from "react";
import { useMonitors } from "../hooks/useMonitors";
import ScreenMap from "./ScreenMap";
import OverlayContextMenu, { menuPosition } from "./OverlayContextMenu";

/** Startseite: alle Monitore mit den Positionen der Overlays. */
export default function DashboardPage({
  overlays,
  openIds,
  maximizedIds,
  selectedId,
  onSelect,
  onSetOpen,
  onToggle,
  onMaximize,
  onLocked,
  onAudio,
  onDuplicate,
}) {
  const monitors = useMonitors();
  const allIds = overlays.map((o) => o.id);
  const [menu, setMenu] = useState(null); // { id, x, y }
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuOverlay = menu ? overlays.find((o) => o.id === menu.id) : null;

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
          onContextMenu={(id, e) => {
            e.preventDefault();
            setMenu({ id, ...menuPosition(e) });
          }}
          maxHeight={460}
        />
        <p className="hint legend">
          <span className="swatch open" /> geöffnet
          <span className="swatch" /> geschlossen
          · Klick öffnet die Einstellungen, Rechtsklick die Schnellaktionen.
        </p>
      </section>

      {menu && menuOverlay && (
        <OverlayContextMenu
          overlay={menuOverlay}
          x={menu.x}
          y={menu.y}
          isOpen={openIds.includes(menuOverlay.id)}
          isMaximized={maximizedIds.includes(menuOverlay.id)}
          onClose={closeMenu}
          onToggleOpen={() => onToggle(menuOverlay.id)}
          onMaximize={() => onMaximize(menuOverlay.id)}
          onLocked={(locked) => onLocked(menuOverlay.id, locked)}
          onAudio={(volume, muted) => onAudio(menuOverlay.id, volume, muted)}
          onDuplicate={() => onDuplicate(menuOverlay.id)}
          onEdit={() => onSelect(menuOverlay.id)}
        />
      )}
    </div>
  );
}
