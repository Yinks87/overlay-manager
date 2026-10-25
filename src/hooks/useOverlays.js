import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, NEW_OVERLAY } from "../api";
import { applyLayoutToState, applyMove, buildTree, toLayout } from "../layout";

/** Zentraler Zustand: SQLite (über Tauri-Commands) ist die Quelle der Wahrheit. */
export function useOverlays() {
  const [overlays, setOverlays] = useState([]);
  const [groups, setGroups] = useState([]);
  const [openIds, setOpenIds] = useState([]);
  const [maximizedIds, setMaximizedIds] = useState([]);
  const [error, setError] = useState(null);
  const audioTimers = useRef({});
  const state = useRef({ overlays: [], groups: [] });
  state.current = { overlays, groups };

  const patch = useCallback((id, changes) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);
  const patchGroup = useCallback((id, changes) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...changes } : g)));
  }, []);

  const reload = useCallback(async () => {
    try {
      const [list, groupList, open, maxed] = await Promise.all([
        api.listOverlays(),
        api.listGroups(),
        api.getOpenOverlays(),
        api.getMaximizedOverlays(),
      ]);
      setOverlays(list);
      setGroups(groupList);
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
    groups,
    openIds,
    maximizedIds,
    error,
    setError,
    createGroup: () =>
      run(async () => {
        const created = await api.createGroup("Neue Gruppe");
        setGroups((p) => [...p, created]);
        return created;
      }),
    renameGroup: (id, name) =>
      run(async () => {
        await api.renameGroup(id, name);
        patchGroup(id, { name: name.trim() });
      }),
    toggleGroupCollapsed: (id) => {
      const group = state.current.groups.find((g) => g.id === id);
      if (!group) return;
      patchGroup(id, { collapsed: !group.collapsed });
      run(() => api.setGroupCollapsed(id, !group.collapsed));
    },
    removeGroup: (id) =>
      run(async () => {
        await api.deleteGroup(id);
        await reload(); // Overlays der Gruppe rücken auf die oberste Ebene
      }),
    // Drag & Drop: sofort anzeigen, dann speichern (bei Fehler neu laden).
    moveItem: (drag, drop) => {
      const { overlays: os, groups: gs } = state.current;
      const next = applyMove(toLayout(buildTree(os, gs)), drag, drop);
      if (!next) return;
      const applied = applyLayoutToState(next, os, gs);
      setOverlays(applied.overlays);
      setGroups(applied.groups);
      api.saveLayout(next).catch((e) => {
        setError(String(e));
        reload();
      });
    },
    // Mehrere Overlays auf einmal öffnen (aktivieren) oder schließen (deaktivieren).
    setOpen: (ids, open) =>
      run(async () => {
        if (ids.length) await api.setOverlaysOpen(ids, open);
        await reload();
      }),
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
    setReference: (id) =>
      run(async () => {
        const saved = await api.setReference(id);
        patch(id, saved);
        return saved;
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
