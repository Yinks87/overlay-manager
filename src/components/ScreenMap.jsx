/** Miniatur des Hauptbildschirms: zeigt, wo welches Overlay liegt. */
export default function ScreenMap({ overlays, openIds, selectedId, onSelect }) {
  const sw = Math.round(window.screen.width * window.devicePixelRatio) || 1920;
  const sh = Math.round(window.screen.height * window.devicePixelRatio) || 1080;
  const pct = (v, total) => `${(Math.max(0, Math.min(v, total)) / total) * 100}%`;

  return (
    <figure className="screenmap">
      <div className="screen" style={{ aspectRatio: `${sw} / ${sh}` }}>
        <i className="mark tl" /><i className="mark tr" /><i className="mark bl" /><i className="mark br" />
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
            style={{
              left: pct(o.x, sw),
              top: pct(o.y, sh),
              width: pct(Math.min(o.width, sw - o.x), sw),
              height: pct(Math.min(o.height, sh - o.y), sh),
            }}
          />
        ))}
      </div>
      <figcaption>
        Hauptbildschirm, {sw} × {sh} px
      </figcaption>
    </figure>
  );
}
