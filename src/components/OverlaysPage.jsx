import { useState } from "react";
import OverlayList from "./OverlayList";
import OverlayEditor from "./OverlayEditor";

/** Gesamtes Overlay-Handling: Liste mit Gruppen (links) und Einstellungen des gewählten Overlays (rechts). */
export default function OverlaysPage({ o, selectedId, onSelect }) {
  const [editGroupId, setEditGroupId] = useState(null);
  const selected = o.overlays.find((x) => x.id === selectedId) ?? null;
  const allIds = o.overlays.map((x) => x.id);

  async function handleCreate() {
    const created = await o.create();
    if (created) onSelect(created.id);
  }

  async function handleCreateGroup() {
    const created = await o.createGroup();
    if (created) setEditGroupId(created.id);
  }

  async function handleDelete(id) {
    await o.remove(id);
    onSelect(null);
  }

  return (
    <div className="overlays-page">
      <section className="list-panel">
        <header className="sidebar-head">
          <h2 className="panel-title">Overlays</h2>
          <button className="btn primary" onClick={handleCreate}>
            Neues Overlay
          </button>
        </header>

        <div className="list-tools">
          <button className="btn small" onClick={handleCreateGroup}>
            Neue Gruppe
          </button>
          <button
            className="btn small"
            disabled={!allIds.length || allIds.every((id) => o.openIds.includes(id))}
            onClick={() => o.setOpen(allIds, true)}
            title="Alle Overlays öffnen (aktivieren)"
          >
            Alle öffnen
          </button>
          <button
            className="btn small stop"
            disabled={!o.openIds.length}
            onClick={() => o.setOpen(allIds, false)}
            title="Alle Overlays schließen (deaktivieren)"
          >
            Alle schließen
          </button>
        </div>

        <OverlayList
          overlays={o.overlays}
          groups={o.groups}
          openIds={o.openIds}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={o.toggleOpen}
          maximizedIds={o.maximizedIds}
          onMaximize={o.toggleMaximized}
          onMove={o.moveItem}
          onToggleCollapsed={o.toggleGroupCollapsed}
          onRenameGroup={o.renameGroup}
          onDeleteGroup={o.removeGroup}
          onSetOpen={o.setOpen}
          editGroupId={editGroupId}
        />
      </section>

      <section className="editor-panel">
        {selected ? (
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
            onSetReference={() => o.setReference(selected.id)}
          />
        ) : (
          <div className="empty">
            <h2>{o.overlays.length ? "Overlay auswählen" : "Noch kein Overlay angelegt"}</h2>
            <p>
              {o.overlays.length
                ? "Wähle links ein Overlay aus, um es zu bearbeiten."
                : "Lege ein Overlay an, trage eine URL ein und öffne es als eigenes, durchklickbares Fenster."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
