import { useEffect, useState } from "react";

const MIN_SIZE = 200; // entspricht overlay::MIN_SIZE im Backend

const pick = (o) => ({
  name: o.name,
  url: o.url,
  x: o.x,
  y: o.y,
  width: o.width,
  height: o.height,
  transparentBg: o.transparentBg,
  borderEnabled: o.borderEnabled,
  borderColor: o.borderColor,
  muteIndicator: o.muteIndicator,
});

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function OverlayEditor({
  overlay,
  isOpen,
  onSave,
  onDelete,
  onDuplicate,
  onToggleOpen,
  isMaximized,
  onMaximize,
  onAudio,
  onLocked,
  onSetReference,
}) {
  const [draft, setDraft] = useState(() => pick(overlay));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Position/Größe werden beim Verschieben des Fensters automatisch nachgeführt,
  // solange der Nutzer im Formular nichts geändert hat.
  useEffect(() => {
    if (!dirty) setDraft(pick(overlay));
  }, [overlay, dirty]);

  const set = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };
  const num = (key) => (e) => set(key, e.target.value === "" ? "" : Number(e.target.value));

  async function save() {
    setSaving(true);
    const saved = await onSave({
      ...draft,
      x: Number(draft.x) || 0,
      y: Number(draft.y) || 0,
      width: Math.max(MIN_SIZE, Number(draft.width) || 0),
      height: Math.max(MIN_SIZE, Number(draft.height) || 0),
      // „Live“-Werte kommen direkt vom gespeicherten Overlay:
      locked: overlay.locked,
      volume: overlay.volume,
      muted: overlay.muted,
    });
    setSaving(false);
    if (saved) setDirty(false);
  }

  const percent = Math.round(overlay.volume * 100);
  const zoomPercent = Math.round(
    Math.min(Math.max(Math.min(overlay.width / overlay.baseWidth, overlay.height / overlay.baseHeight), 0.25), 5) * 100
  );

  return (
    <div className="editor">
      <header className="editor-head">
        <div>
          <input
            className="title-input"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            aria-label="Name des Overlays"
          />
          <p className="status">
            <span className={isOpen ? "dot live" : "dot"} aria-hidden="true" />
            {isOpen
              ? overlay.locked
                ? "Läuft, durchklickbar"
                : "Läuft im Bearbeitungsmodus"
              : "Nicht geöffnet"}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={onMaximize} disabled={!isOpen}>
            {isMaximized ? "Verkleinern" : "Maximieren"}
          </button>
          <button className={isOpen ? "btn stop" : "btn primary"} onClick={onToggleOpen}>
            {isOpen ? "Overlay schließen" : "Overlay öffnen"}
          </button>
        </div>
      </header>

      <section className="group">
        <h3>Inhalt</h3>
        <label className="field">
          <span>Webadresse</span>
          <input
            type="url"
            value={draft.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
            spellCheck="false"
          />
        </label>
        <Switch
          label="Seitenhintergrund transparent machen"
          hint="Macht den Hintergrund der Webseite (html/body) durchsichtig, sodass der Desktop dahinter sichtbar bleibt. Gedacht für Widgets und Stream-Overlays mit einfarbigem Hintergrund. Aus = die Seite zeigt ihren eigenen Hintergrund."
          checked={draft.transparentBg}
          onChange={(v) => set("transparentBg", v)}
        />
      </section>

      <section className="group">
        <h3>Fenster</h3>
        <Switch
          label="Bearbeitungsmodus (verschieben und skalieren)"
          hint={
            overlay.locked
              ? "Aus: Das Overlay ist gesperrt und Mausklicks gehen hindurch."
              : "An: Ziehe den Balken oben zum Verschieben und die Ecken/Kanten zum Skalieren. Achtung: In diesem Modus blockiert das Overlay Mausklicks."
          }
          checked={!overlay.locked}
          onChange={(v) => onLocked(!v)}
        />
        <div className="grid4">
          {[
            ["x", "Links (X)"],
            ["y", "Oben (Y)"],
            ["width", "Breite"],
            ["height", "Höhe"],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                type="number"
                value={draft[key]}
                min={key === "width" || key === "height" ? MIN_SIZE : undefined}
                onChange={num(key)}
              />
            </label>
          ))}
        </div>
        <p className="hint">Angaben in Bildschirmpixeln. Mindestgröße: {MIN_SIZE} × {MIN_SIZE}.</p>
        <div className="zoom-row">
          <span className="switch-text">
            <span className="switch-label">Zoom: {zoomPercent} %</span>
            <span className="hint">
              Die Seite wird so skaliert, dass sie bei jeder Fenstergröße komplett sichtbar ist.
              100 % gilt bei der Referenzgröße {overlay.baseWidth} × {overlay.baseHeight}.
            </span>
          </span>
          <button className="btn small" onClick={onSetReference}>
            Aktuelle Größe = 100 %
          </button>
        </div>
        <Switch
          label="Farbigen Rahmen anzeigen"
          hint="Markiert die Position des Overlays auf dem Bildschirm. Im Bearbeitungsmodus ist der Rahmen immer sichtbar."
          checked={draft.borderEnabled}
          onChange={(v) => set("borderEnabled", v)}
        />
        <label className="color-row">
          <span>Rahmenfarbe</span>
          <input
            type="color"
            value={draft.borderColor}
            onChange={(e) => set("borderColor", e.target.value)}
            aria-label="Rahmenfarbe"
          />
          <code>{draft.borderColor}</code>
        </label>
      </section>

      <section className="group">
        <h3>Audio</h3>
        <div className="audio">
          <input
            type="range"
            min="0"
            max="100"
            value={percent}
            disabled={overlay.muted}
            onChange={(e) => onAudio(Number(e.target.value) / 100, overlay.muted)}
            aria-label="Lautstärke"
          />
          <output>{overlay.muted ? "Stumm" : `${percent} %`}</output>
          <button
            className={overlay.muted ? "btn small stop" : "btn small"}
            onClick={() => onAudio(overlay.volume, !overlay.muted)}
            aria-pressed={overlay.muted}
          >
            {overlay.muted ? "Ton einschalten" : "Stummschalten"}
          </button>
        </div>
        <p className="hint">Die Lautstärke wirkt sofort und wird automatisch gespeichert.</p>
        <Switch
          label="Stumm-Symbol im Overlay anzeigen"
          hint="Blendet ein kleines durchgestrichenes Lautsprecher-Symbol im Overlay ein, solange es stummgeschaltet ist."
          checked={draft.muteIndicator}
          onChange={(v) => set("muteIndicator", v)}
        />
      </section>

      <footer className="actions">
        <button className="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Speichert …" : "Änderungen speichern"}
        </button>
        {dirty && (
          <button className="btn ghost" onClick={() => { setDraft(pick(overlay)); setDirty(false); }}>
            Verwerfen
          </button>
        )}
        <span className="spacer" />
        <button
          className="btn ghost"
          onClick={onDuplicate}
          disabled={dirty}
          title={dirty ? "Erst die Änderungen speichern oder verwerfen" : "Overlay mit allen Einstellungen kopieren"}
        >
          Overlay kopieren
        </button>
        {confirmDelete ? (
          <>
            <span className="hint">Overlay endgültig löschen?</span>
            <button className="btn danger" onClick={onDelete}>Ja, löschen</button>
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
          </>
        ) : (
          <button className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
            Overlay löschen
          </button>
        )}
      </footer>
    </div>
  );
}
