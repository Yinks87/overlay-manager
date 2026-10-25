const intersects = (o, m) =>
  o.x < m.x + m.width && o.x + o.width > m.x && o.y < m.y + m.height && o.y + o.height > m.y;

/**
 * Miniatur aller angeschlossenen Monitore in ihrer tatsächlichen Anordnung.
 * Zeigt, wo welches Overlay liegt und auf welchem Monitor das Dashboard ist.
 */
export default function ScreenMap({ monitors, overlays, openIds, selectedId, onSelect, maxHeight = 240 }) {
  if (!monitors.length) return <p className="hint">Monitore werden ermittelt …</p>;

  const minX = Math.min(...monitors.map((m) => m.x));
  const minY = Math.min(...monitors.map((m) => m.y));
  const maxX = Math.max(...monitors.map((m) => m.x + m.width));
  const maxY = Math.max(...monitors.map((m) => m.y + m.height));
  const totalW = maxX - minX;
  const totalH = maxY - minY;
  const px = (v) => `${(v / totalW) * 100}%`;
  const py = (v) => `${(v / totalH) * 100}%`;

  const outside = overlays.filter((o) => !monitors.some((m) => intersects(o, m)));

  return (
    <figure className="screenmap">
      <div
        className="desktop"
        style={{ aspectRatio: `${totalW} / ${totalH}`, maxWidth: `${(maxHeight * totalW) / totalH}px` }}
      >
        {monitors.map((m) => (
          <div
            key={m.index}
            className={m.dashboard ? "monitor has-dashboard" : "monitor"}
            style={{ left: px(m.x - minX), top: py(m.y - minY), width: px(m.width), height: py(m.height) }}
            title={`Monitor ${m.index}: ${m.width} × ${m.height} px${m.primary ? " (Hauptmonitor)" : ""}${m.dashboard ? " – Dashboard" : ""}`}
          >
            <span className="monitor-no">{m.index}</span>
          </div>
        ))}
        {overlays.map((o) => (
          <button
            key={o.id}
            title={o.name}
            onClick={() => onSelect(o.id)}
            className={[
              "ghost-rect",
              openIds.includes(o.id) ? "open" : "",
              o.id === selectedId ? "sel" : "",
            ].join(" ")}
            style={{ left: px(o.x - minX), top: py(o.y - minY), width: px(o.width), height: py(o.height) }}
          >
            <span className="ghost-label">{o.name}</span>
          </button>
        ))}
      </div>
      <figcaption>
        <ul className="monitor-list">
          {monitors.map((m) => (
            <li key={m.index}>
              <strong>{m.index}</strong> {m.width} × {m.height} px
              {m.primary && <span className="tag">Hauptmonitor</span>}
              {m.dashboard && <span className="tag accent">Dashboard</span>}
            </li>
          ))}
        </ul>
        {outside.length > 0 && (
          <p className="hint warn">
            Außerhalb aller Monitore: {outside.map((o) => o.name).join(", ")}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
