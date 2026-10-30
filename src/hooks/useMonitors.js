import { useEffect, useState } from "react";
import { availableMonitors, currentMonitor, getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";

const sameMonitor = (a, b) =>
  !!a && !!b &&
  a.position.x === b.position.x && a.position.y === b.position.y &&
  a.size.width === b.size.width && a.size.height === b.size.height;

export function useMonitors() {
  const [monitors, setMonitors] = useState([]);

  useEffect(() => {
    let alive = true;
    let timer = null;

    const refresh = async () => {
      try {
        const [all, primary, current] = await Promise.all([
          availableMonitors(),
          primaryMonitor(),
          currentMonitor(),
        ]);
        if (!alive) return;
        const sorted = [...all].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
        setMonitors(
          sorted.map((m, i) => ({
            index: i + 1,
            x: m.position.x,
            y: m.position.y,
            width: m.size.width,
            height: m.size.height,
            scale: m.scaleFactor,
            primary: sameMonitor(m, primary),
            dashboard: sameMonitor(m, current),
          }))
        );
      } catch (_) {
        // Monitorinfos sind rein informativ.
      }
    };
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };

    refresh();
    const win = getCurrentWindow();
    const subs = [win.onMoved(refreshSoon), win.onResized(refreshSoon), win.onScaleChanged(refreshSoon)];
    window.addEventListener("focus", refreshSoon);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("focus", refreshSoon);
      subs.forEach((p) => p.then((unlisten) => unlisten()).catch(() => {}));
    };
  }, []);

  return monitors;
}
