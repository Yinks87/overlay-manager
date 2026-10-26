import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Menüposition aus einem contextmenu-Event; per Tastatur (keine Mauskoordinaten) unter dem Element. */
export function menuPosition(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  return { x: fromKeyboard ? r.left + 24 : e.clientX, y: fromKeyboard ? r.bottom : e.clientY };
}

/**
 * Kontextmenü einer Overlay-Karte. Zeigt immer den aktuellen Zustand des Overlays
 * (Lautstärke, Stumm, Bearbeitungsmodus) und bleibt bei Einstellungen offen,
 * bei Aktionen (Öffnen, Maximieren, Kopieren …) schließt es sich.
 */
export default function OverlayContextMenu({
  overlay,
  x,
  y,
  isOpen,
  isMaximized,
  onClose,
  onToggleOpen,
  onMaximize,
  onLocked,
  onAudio,
  onDuplicate,
  onEdit,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [copied, setCopied] = useState(false);

  // Im sichtbaren Bereich halten.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - height - 4)),
    });
  }, [x, y]);

  useEffect(() => {
    ref.current?.querySelector("button:not(:disabled)")?.focus();
    const outside = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  // Pfeiltasten wechseln zwischen den Einträgen.
  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll("button:not(:disabled), input")];
    const i = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? i + 1 : i - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  const act = (fn) => () => {
    onClose();
    fn();
  };

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(overlay.url);
      setCopied(true);
      setTimeout(onClose, 700);
    } catch (_) {
      onClose();
    }
  }

  const percent = Math.round(overlay.volume * 100);

  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      aria-label={`Aktionen für ${overlay.name}`}
      style={pos}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-title" title={overlay.name}>{overlay.name}</div>

      <button className="ctx-item" role="menuitem" onClick={act(onToggleOpen)}>
        {isOpen ? "Schließen" : "Öffnen"}
      </button>
      <button className="ctx-item" role="menuitem" disabled={!isOpen} onClick={act(onMaximize)}>
        {isMaximized ? "Verkleinern" : "Maximieren"}
      </button>
      <button className="ctx-item" role="menuitem" onClick={act(onEdit)}>
        Einstellungen bearbeiten
      </button>

      <div className="ctx-sep" role="separator" />

      <button
        className="ctx-item"
        role="menuitemcheckbox"
        aria-checked={!overlay.locked}
        onClick={() => onLocked(!overlay.locked)}
      >
        <span className="ctx-check">{!overlay.locked ? "✓" : ""}</span>
        Bearbeitungsmodus
      </button>
      <button
        className="ctx-item"
        role="menuitemcheckbox"
        aria-checked={overlay.muted}
        onClick={() => onAudio(overlay.volume, !overlay.muted)}
      >
        <span className="ctx-check">{overlay.muted ? "✓" : ""}</span>
        Stummschalten
      </button>
      <label className="ctx-slider">
        <span>Lautstärke</span>
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
      </label>

      <div className="ctx-sep" role="separator" />

      <button className="ctx-item" role="menuitem" onClick={act(onDuplicate)}>
        Kopieren (Duplizieren)
      </button>
      <button className="ctx-item" role="menuitem" onClick={copyUrl}>
        {copied ? "URL kopiert ✓" : "URL in die Zwischenablage"}
      </button>
    </div>,
    document.body
  );
}
