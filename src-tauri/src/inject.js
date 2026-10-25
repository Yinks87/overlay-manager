// Wird in jeden Frame der Overlay-Seite injiziert (vor dem Seitencode).
// Platzhalter (__VOLUME__ …) ersetzt Rust. UI wird nur im obersten Frame gezeichnet.
(() => {
  if (window.__overlayConfig) return;
  const cfg = {
    volume: __VOLUME__,
    muted: __MUTED__,
    transparent: __TRANSPARENT__,
    edit: __EDIT__,
    border: __BORDER__,
    borderColor: __BORDER_COLOR__,
    muteIcon: __MUTE_ICON__,
    name: __NAME__,
    label: __LABEL__,
    zoom: __ZOOM__,
  };
  const isTop = window.top === window;
  const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  const level = () => (cfg.muted ? 0 : clamp01(cfg.volume));

  // ── 1) <audio>/<video> ──
  const volDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
  const wanted = new WeakMap();
  const tracked = new Set();
  const applyMedia = (el) => {
    tracked.add(el);
    volDesc.set.call(el, clamp01((wanted.has(el) ? wanted.get(el) : 1) * level()));
  };
  Object.defineProperty(HTMLMediaElement.prototype, "volume", {
    configurable: true,
    enumerable: true,
    get() { return wanted.has(this) ? wanted.get(this) : 1; },
    set(v) { wanted.set(this, clamp01(v)); applyMedia(this); },
  });
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    applyMedia(this);
    return origPlay.apply(this, args);
  };
  for (const ev of ["loadstart", "loadedmetadata", "play"]) {
    document.addEventListener(ev, (e) => {
      if (e.target instanceof HTMLMediaElement) applyMedia(e.target);
    }, true);
  }

  // ── 2) Web Audio: Master-Gain vor dem Ausgang ──
  const masters = new Set();
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Orig = window[name];
    if (!Orig || Orig.__overlayPatched) continue;
    const Patched = function (...args) {
      const ctx = new Orig(...args);
      const master = ctx.createGain();
      master.gain.value = level();
      master.connect(ctx.destination);
      masters.add(master);
      Object.defineProperty(ctx, "destination", { value: master, configurable: true });
      return ctx;
    };
    Patched.prototype = Orig.prototype;
    Patched.__overlayPatched = true;
    window[name] = Patched;
  }

  // ── 3) Transparenter Hintergrund (konstruierte Stylesheets: CSP-sicher) ──
  let tSheet = null;
  function setTransparent(on) {
    try {
      if (!tSheet) {
        tSheet = new CSSStyleSheet();
        tSheet.replaceSync("html,body{background:transparent!important;background-color:transparent!important}");
      }
      const cur = document.adoptedStyleSheets;
      const has = cur.includes(tSheet);
      if (on && !has) document.adoptedStyleSheets = [...cur, tSheet];
      if (!on && has) document.adoptedStyleSheets = cur.filter((s) => s !== tSheet);
    } catch (_) {}
  }

  // ── 4) Farbiger Rahmen + Bearbeitungsmodus (Verschiebe-Balken, Anfasser) ──
  const tauriInvoke = (cmd, args) => {
    try {
      const i = window.__TAURI_INTERNALS__;
      if (i && i.invoke) return Promise.resolve(i.invoke(cmd, args)).catch(() => {});
    } catch (_) {}
  };
  const lum = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  const DIRS = [
    ["North", "n"], ["South", "s"], ["East", "e"], ["West", "w"],
    ["NorthEast", "ne"], ["NorthWest", "nw"], ["SouthEast", "se"], ["SouthWest", "sw"],
  ];
  const CSS = `
    .frame{position:absolute;top:0;left:0;right:0;bottom:0;box-sizing:border-box;border:3px solid var(--c);pointer-events:none}
    .bar{position:absolute;top:0;left:0;right:0;height:26px;box-sizing:border-box;padding:0 14px;display:flex;align-items:center;
         background:var(--c);font:600 11.5px/1 "Segoe UI",system-ui,sans-serif;cursor:move;pointer-events:auto;user-select:none;white-space:nowrap;overflow:hidden}
    .h{position:absolute;pointer-events:auto}
    /* Kanten: unsichtbare Griffzone, zeigt beim Überfahren eine kleine Markierung */
    .n,.s{left:24px;right:24px;height:10px}
    .e,.w{top:24px;bottom:24px;width:10px}
    .n{top:0;cursor:ns-resize}.s{bottom:0;cursor:ns-resize}
    .e{right:0;cursor:ew-resize}.w{left:0;cursor:ew-resize}
    .n::after,.s::after,.e::after,.w::after{content:"";position:absolute;border-radius:3px;background:var(--c);
         box-shadow:0 0 0 1px rgba(0,0,0,.35);opacity:0;transition:opacity .12s}
    .n::after,.s::after{left:50%;width:40px;height:5px;margin-left:-20px}
    .n::after{top:0}.s::after{bottom:0}
    .e::after,.w::after{top:50%;height:40px;width:5px;margin-top:-20px}
    .e::after{right:0}.w::after{left:0}
    .h:hover::after{opacity:1}
    /* Ecken: schmale Winkel statt Klötze */
    .ne,.nw,.se,.sw{width:24px;height:24px}
    .ne::after,.nw::after,.se::after,.sw::after{content:"";position:absolute;width:16px;height:16px;border:0 solid var(--c);
         filter:drop-shadow(0 0 1px rgba(0,0,0,.55))}
    .ne{top:0;right:0;cursor:nesw-resize}.nw{top:0;left:0;cursor:nwse-resize}
    .se{bottom:0;right:0;cursor:nwse-resize}.sw{bottom:0;left:0;cursor:nesw-resize}
    .ne::after{top:0;right:0;border-top-width:5px;border-right-width:5px;border-top-right-radius:4px}
    .nw::after{top:0;left:0;border-top-width:5px;border-left-width:5px;border-top-left-radius:4px}
    .se::after{bottom:0;right:0;border-bottom-width:5px;border-right-width:5px;border-bottom-right-radius:4px}
    .sw::after{bottom:0;left:0;border-bottom-width:5px;border-left-width:5px;border-bottom-left-radius:4px}
    /* Stumm-Symbol */
    .mute{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.62);
         display:none;align-items:center;justify-content:center;pointer-events:none}
    .mute.edit{top:38px}`;
  let ui = null;
  // Rahmen, Balken, Anfasser und Symbol gehören zum Fenster, nicht zur Seite: Der
  // WebView-Zoom wird hier gegengerechnet, damit sie immer in Originalgröße erscheinen.
  function layoutHost(host) {
    const z = cfg.zoom > 0 ? cfg.zoom : 1;
    host.style.width = 100 * z + "vw";
    host.style.height = 100 * z + "vh";
    host.style.transform = "scale(" + 1 / z + ")";
  }
  function ensureUi() {
    if (!isTop) return null;
    const root = document.documentElement;
    if (!root) return null;
    if (!ui) {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;top:0;left:0;transform-origin:0 0;z-index:2147483647;pointer-events:none;display:none;";
      layoutHost(host);
      const sh = host.attachShadow({ mode: "closed" });
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        sh.adoptedStyleSheets = [sheet];
      } catch (_) {
        const st = document.createElement("style");
        st.textContent = CSS;
        sh.appendChild(st);
      }
      const el = (cls) => { const d = document.createElement("div"); d.className = cls; sh.appendChild(d); return d; };
      const frame = el("frame");
      const bar = el("bar");
      const title = document.createElement("span");
      bar.appendChild(title);
      bar.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        tauriInvoke("plugin:window|start_dragging", { label: cfg.label });
      });
      const handles = DIRS.map(([dir, cls]) => {
        const h = el("h " + cls);
        h.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          tauriInvoke("plugin:window|start_resize_dragging", { label: cfg.label, value: dir });
        });
        return h;
      });
      const muteEl = el("mute");
      const NS = "http://www.w3.org/2000/svg";
      const mk = (tag, attrs, parent) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        parent.appendChild(e);
        return e;
      };
      const svg = mk("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "#fff", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }, muteEl);
      mk("path", { d: "M11 5 6 9H3v6h3l5 4z", fill: "#fff" }, svg);
      mk("path", { d: "M16 9l5 6M21 9l-5 6" }, svg);
      ui = { host, frame, bar, title, handles, mute: muteEl };
      new MutationObserver(() => { if (!host.isConnected) root.appendChild(host); })
        .observe(root, { childList: true });
    }
    if (!ui.host.isConnected) root.appendChild(ui.host);
    return ui;
  }
  function updateUi() {
    if (!isTop) return;
    const showMute = cfg.muted && cfg.muteIcon;
    const showFrame = cfg.edit || cfg.border;
    const show = showFrame || showMute;
    if (!show && !ui) return;
    const u = ensureUi();
    if (!u) return;
    u.host.style.setProperty("--c", cfg.borderColor);
    u.host.style.display = show ? "block" : "none";
    u.frame.style.display = showFrame ? "block" : "none";
    u.bar.style.display = cfg.edit ? "flex" : "none";
    u.bar.style.color = lum(cfg.borderColor) > 0.6 ? "#111" : "#fff";
    u.handles.forEach((h) => { h.style.display = cfg.edit ? "block" : "none"; });
    u.mute.style.display = showMute ? "flex" : "none";
    u.mute.classList.toggle("edit", cfg.edit);
    u.title.textContent = "\u2725  " + cfg.name + "  \u2013  hier ziehen zum Verschieben";
  }

  function apply() {
    document.querySelectorAll("audio,video").forEach(applyMedia);
    tracked.forEach((el) => {
      if (!el.isConnected && el.paused) tracked.delete(el);
      else applyMedia(el);
    });
    masters.forEach((g) => { try { g.gain.value = level(); } catch (_) {} });
    setTransparent(cfg.transparent);
    updateUi();
    for (let i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage({ __overlayCfg: cfg }, "*"); } catch (_) {}
    }
  }

  window.__overlayConfig = (c) => { Object.assign(cfg, c); apply(); };
  window.__overlaySetZoom = (z) => {
    cfg.zoom = Number(z) || 1;
    if (ui) layoutHost(ui.host);
  };
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d && d.__overlayCfg && window.parent !== window && e.source === window.parent) {
      Object.assign(cfg, d.__overlayCfg);
      apply();
    }
  });
  document.addEventListener("DOMContentLoaded", apply);
  window.addEventListener("load", apply);
  apply();
})();
