const IconMax = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const IconRestore = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2.5" y="5.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5.5 5.5V2.5h8v8h-3" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export default function OverlayList({
  overlays,
  openIds,
  maximizedIds,
  selectedId,
  onSelect,
  onToggle,
  onMaximize,
}) {
  if (!overlays.length) return <div className="list-empty">Keine Overlays vorhanden.</div>;

  return (
    <ul className="list">
      {overlays.map((o) => {
        const open = openIds.includes(o.id);
        const maxed = maximizedIds.includes(o.id);
        return (
          <li key={o.id} className={o.id === selectedId ? "row selected" : "row"}>
            <button className="row-main" onClick={() => onSelect(o.id)}>
              <span className={open ? "dot live" : "dot"} aria-hidden="true" />
              <span className="row-text">
                <span className="row-name">{o.name}</span>
                <span className="row-url">{o.url.replace(/^https?:\/\//, "")}</span>
              </span>
            </button>
            <button
              className="btn small icon"
              disabled={!open}
              onClick={() => onMaximize(o.id)}
              title={maxed ? "Verkleinern" : "Maximieren"}
              aria-label={maxed ? `${o.name} verkleinern` : `${o.name} maximieren`}
            >
              {maxed ? <IconRestore /> : <IconMax />}
            </button>
            <button
              className={open ? "btn small stop" : "btn small"}
              onClick={() => onToggle(o.id)}
              aria-label={open ? `${o.name} schließen` : `${o.name} öffnen`}
            >
              {open ? "Schließen" : "Öffnen"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
