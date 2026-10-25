import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, NEW_OVERLAY } from "../api";

/** Zentraler Zustand: SQLite (über Tauri-Commands) ist die Quelle der Wahrheit. */
export function useOverlays() {
  const [overlays, setOverlays] = useState([]);
  const [openIds, setOpenIds] = useState([]);
  const [maximizedIds, setMaximizedIds] = useState([]);
  const [error, setError] = useState(null);
  const audioTimers = useRef({});

  const patch = useCallback((id, changes) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);

  const reload = useCallback(async () => {
    try {
      const [list, open, maxed] = await Promise.all([
        api.listOverlays(),
        api.getOpenOverlays(),
        api.getMaximizedOverlays(),
      ]);
      setOverlays(list);
      setOpenIds(open);
      setMaximizedIds(maxed);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    // Backend meldet: Fenster geöffnet/geschlossen bzw. Position/Größe geändert.
    const subs = [
      listen("overlays-changed", () => reload()),
      listen("overlay-geometry", (e) => patch(e.payload.id, e.payload)),
    ];
    return () => subs.forEach((p) => p.then((unlisten) => unlisten()));
  }, [reload, patch]);

  const run = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      setError(String(e));
      return null;
    }
  };

  return {
    overlays,
    openIds,
    maximizedIds,
    error,
    setError,
    create: () =>
      run(async () => {
        const created = await api.createOverlay(NEW_OVERLAY);
        setOverlays((p) => [...p, created]);
        return created;
      }),
    save: (id, input) =>
      run(async () => {
        const saved = await api.updateOverlay(id, input);
        patch(id, saved);
        return saved;
      }),
    remove: (id) =>
      run(async () => {
        await api.deleteOverlay(id);
        setOverlays((p) => p.filter((o) => o.id !== id));
      }),
    toggleOpen: (id) =>
      run(async () => {
        if (openIds.includes(id)) await api.closeOverlay(id);
        else await api.openOverlay(id);
        await reload();
      }),
    toggleMaximized: (id) =>
      run(async () => {
        await api.toggleMaximized(id);
        await reload(); // Maximieren sperrt das Overlay ggf. automatisch
      }),
    setLocked: async (id, locked) => {
      patch(id, { locked });
      const ok = await run(async () => (await api.setLocked(id, locked), true));
      if (!ok) reload();
    },
    // Slider: sofort anzeigen, Speichern/Anwenden leicht entprellt.
    setAudio: (id, volume, muted) => {
      patch(id, { volume, muted });
      clearTimeout(audioTimers.current[id]);
      audioTimers.current[id] = setTimeout(
        () => run(() => api.setAudio(id, volume, muted)),
        120
      );
    },
  };
}
