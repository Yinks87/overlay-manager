// Listenstruktur: oberste Ebene = Overlays ohne Gruppe + Gruppen (mit ihren Overlays).
// Sortierung identisch zum Backend (db.rs::delete_group): Position, Overlays vor Gruppen, id.

export function buildTree(overlays, groups) {
  const groupIds = new Set(groups.map((g) => g.id));
  const byPosition = (a, b) => a.position - b.position || a.id - b.id;
  const children = new Map();
  const rootOverlays = [];
  for (const o of overlays) {
    if (o.groupId != null && groupIds.has(o.groupId)) {
      if (!children.has(o.groupId)) children.set(o.groupId, []);
      children.get(o.groupId).push(o);
    } else {
      rootOverlays.push(o);
    }
  }
  return [
    ...rootOverlays.map((o) => ({ type: "overlay", id: o.id, position: o.position, rank: 0, overlay: o })),
    ...groups.map((g) => ({
      type: "group",
      id: g.id,
      position: g.position,
      rank: 1,
      group: g,
      children: (children.get(g.id) ?? []).sort(byPosition),
    })),
  ].sort((a, b) => a.position - b.position || a.rank - b.rank || a.id - b.id);
}

export const toLayout = (tree) =>
  tree.map((item) =>
    item.type === "group"
      ? { type: "group", id: item.id, children: item.children.map((o) => o.id) }
      : { type: "overlay", id: item.id }
  );

/**
 * Verschiebt ein Element in der Listenstruktur.
 * drag: { type: "overlay" | "group", id }
 * drop: { kind: "before" | "after" | "into" | "end", type?, id? }
 *   before/after: relativ zum Ziel (Overlay oder Gruppe), into: ans Ende einer Gruppe,
 *   end: ans Ende der obersten Ebene.
 * Gibt `null` zurück, wenn sich nichts ändert.
 */
export function applyMove(layout, drag, drop) {
  if (drop.type === drag.type && drop.id === drag.id) return null;
  if (drag.type === "group" && drop.kind === "into") return null;

  const next = layout.map((i) => (i.type === "group" ? { ...i, children: [...i.children] } : { ...i }));
  const removeDragged = () => {
    if (drag.type === "group") {
      const idx = next.findIndex((i) => i.type === "group" && i.id === drag.id);
      if (idx >= 0) next.splice(idx, 1);
      return;
    }
    const rootIdx = next.findIndex((i) => i.type === "overlay" && i.id === drag.id);
    if (rootIdx >= 0) {
      next.splice(rootIdx, 1);
      return;
    }
    for (const g of next) {
      if (g.type !== "group") continue;
      const idx = g.children.indexOf(drag.id);
      if (idx >= 0) g.children.splice(idx, 1);
    }
  };
  removeDragged();

  const dragItem = drag.type === "group" ? layout.find((i) => i.type === "group" && i.id === drag.id) : { type: "overlay", id: drag.id };
  if (!dragItem) return null;
  const entry = drag.type === "group" ? { ...dragItem, children: [...dragItem.children] } : dragItem;

  const after = drop.kind === "after" ? 1 : 0;

  if (drop.kind === "end") {
    next.push(entry);
  } else if (drop.kind === "into") {
    const g = next.find((i) => i.type === "group" && i.id === drop.id);
    if (!g) return null;
    g.children.push(drag.id);
  } else if (drop.type === "group") {
    const idx = next.findIndex((i) => i.type === "group" && i.id === drop.id);
    if (idx < 0) return null;
    next.splice(idx + after, 0, entry);
  } else {
    // Ziel ist ein Overlay: auf oberster Ebene oder innerhalb einer Gruppe
    const rootIdx = next.findIndex((i) => i.type === "overlay" && i.id === drop.id);
    if (rootIdx >= 0) {
      next.splice(rootIdx + after, 0, entry);
    } else {
      const g = next.find((i) => i.type === "group" && i.children.includes(drop.id));
      if (!g) return null;
      if (drag.type === "group") {
        next.splice(next.indexOf(g) + after, 0, entry);
      } else {
        g.children.splice(g.children.indexOf(drop.id) + after, 0, drag.id);
      }
    }
  }
  return next;
}

/** Überträgt eine Listenstruktur auf Overlays/Gruppen (Position und Gruppenzugehörigkeit). */
export function applyLayoutToState(layout, overlays, groups) {
  const overlayInfo = new Map();
  const groupPos = new Map();
  layout.forEach((item, index) => {
    if (item.type === "overlay") {
      overlayInfo.set(item.id, { groupId: null, position: index });
    } else {
      groupPos.set(item.id, index);
      item.children.forEach((id, i) => overlayInfo.set(id, { groupId: item.id, position: i }));
    }
  });
  return {
    overlays: overlays.map((o) => (overlayInfo.has(o.id) ? { ...o, ...overlayInfo.get(o.id) } : o)),
    groups: groups.map((g) => (groupPos.has(g.id) ? { ...g, position: groupPos.get(g.id) } : g)),
  };
}
