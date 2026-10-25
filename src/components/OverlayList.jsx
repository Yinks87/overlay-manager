import { useEffect, useMemo, useRef, useState } from "react";
import { buildTree } from "../layout";

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
  groups,
  openIds,
  maximizedIds,
  selectedId,
  onSelect,
  onToggle,
  onMaximize,
  onMove,
  onToggleCollapsed,
  onRenameGroup,
  onDeleteGroup,
  onSetOpen,
  editGroupId,
}) {
  const tree = useMemo(() => buildTree(overlays, groups), [overlays, groups]);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(null); // { type, id, kind }
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (editGroupId != null) setEditing(editGroupId);
  }, [editGroupId]);

  if (!overlays.length && !groups.length) {
    return <div className="list-empty">Keine Overlays vorhanden.</div>;
  }

  const showHint = (next) =>
    setHint((prev) =>
      prev && next && prev.type === next.type && prev.id === next.id && prev.kind === next.kind ? prev : next
    );
  const halfOf = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? "before" : "after";
  };
  const hintClass = (type, id) => (hint && hint.type === type && hint.id === id ? `drop-${hint.kind}` : "");

  const startDrag = (e, item) => {
    e.stopPropagation();
    dragRef.current = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${item.type}:${item.id}`);
    // Nicht synchron rendern: Änderungen am DOM innerhalb von dragstart brechen das Ziehen ab.
    setTimeout(() => setDragging(true), 0);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
    setHint(null);
  };
  const drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = dragRef.current;
    if (drag && hint) onMove(drag, hint);
    endDrag();
  };
  const over = (e, next) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    showHint(next);
  };

  const renderOverlay = (o, parentGroupId) => {
    const open = openIds.includes(o.id);
    const maxed = maximizedIds.includes(o.id);
    return (
      <li
        key={o.id}
        className={["row", o.id === selectedId ? "selected" : "", hintClass("overlay", o.id)].join(" ")}
        draggable
        onDragStart={(e) => startDrag(e, { type: "overlay", id: o.id })}
        onDragEnd={endDrag}
        onDragOver={(e) => {
          const drag = dragRef.current;
          const kind = halfOf(e);
          // Gruppen lassen sich nicht verschachteln: über einem Gruppen-Eintrag zählt die Gruppe.
          if (drag?.type === "group" && parentGroupId != null) {
            over(e, { type: "group", id: parentGroupId, kind });
          } else {
            over(e, { type: "overlay", id: o.id, kind });
          }
        }}
        onDrop={drop}
      >
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
  };

  const renderGroup = (item) => {
    const { group, children } = item;
    const openCount = children.filter((o) => openIds.includes(o.id)).length;
    const allOpen = children.length > 0 && openCount === children.length;
    const isEditing = editing === group.id;

    const commitName = (value) => {
      setEditing(null);
      const name = value.trim();
      if (name && name !== group.name) onRenameGroup(group.id, name);
    };

    return (
      <li key={`g${group.id}`} className={["lgroup", hintClass("group", group.id)].join(" ")}>
        <div
          className="lgroup-head"
          draggable={!isEditing}
          onDragStart={(e) => startDrag(e, { type: "group", id: group.id })}
          onDragEnd={endDrag}
          onDragOver={(e) =>
            over(
              e,
              dragRef.current?.type === "overlay"
                ? { type: "group", id: group.id, kind: "into" }
                : { type: "group", id: group.id, kind: halfOf(e) }
            )
          }
          onDrop={drop}
        >
          <button
            className="caret"
            onClick={() => onToggleCollapsed(group.id)}
            aria-expanded={!group.collapsed}
            aria-label={group.collapsed ? `${group.name} aufklappen` : `${group.name} zuklappen`}
          >
            {group.collapsed ? "▸" : "▾"}
          </button>
          {isEditing ? (
            <input
              className="lgroup-input"
              autoFocus
              defaultValue={group.name}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => commitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(null);
              }}
              aria-label="Gruppenname"
            />
          ) : (
            <button
              className="lgroup-name"
              onClick={() => onToggleCollapsed(group.id)}
              onDoubleClick={() => setEditing(group.id)}
              title="Doppelklick zum Umbenennen"
            >
              {group.name}
              <span className="count">{openCount}/{children.length}</span>
            </button>
          )}
          {confirmDelete === group.id ? (
            <span className="lgroup-actions">
              <span className="hint">Gruppe löschen?</span>
              <button
                className="btn small danger"
                onClick={() => {
                  setConfirmDelete(null);
                  onDeleteGroup(group.id);
                }}
              >
                Ja
              </button>
              <button className="btn small ghost" onClick={() => setConfirmDelete(null)}>Nein</button>
            </span>
          ) : (
            <span className="lgroup-actions">
              <button
                className={allOpen ? "btn small stop" : "btn small"}
                disabled={!children.length}
                onClick={() => onSetOpen(children.map((o) => o.id), !allOpen)}
                title={allOpen ? "Alle Overlays der Gruppe schließen" : "Alle Overlays der Gruppe öffnen"}
              >
                {allOpen ? "Schließen" : "Öffnen"}
              </button>
              <button className="btn small ghost" onClick={() => setEditing(group.id)} title="Umbenennen" aria-label={`${group.name} umbenennen`}>
                ✎
              </button>
              <button
                className="btn small ghost"
                onClick={() => setConfirmDelete(group.id)}
                title="Gruppe löschen (Overlays bleiben erhalten)"
                aria-label={`${group.name} löschen`}
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {!group.collapsed && (
          <ul className="list lgroup-children">
            {children.map((o) => renderOverlay(o, group.id))}
            {(!children.length || dragging) && (
              <li
                className={["group-end", hint && hint.type === "group" && hint.id === group.id && hint.kind === "into" ? "drop-into" : ""].join(" ")}
                onDragOver={(e) => dragRef.current?.type === "overlay" && over(e, { type: "group", id: group.id, kind: "into" })}
                onDrop={drop}
              >
                {children.length ? "Hier ans Ende der Gruppe" : "Overlays hierher ziehen"}
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul
      className="list"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHint(null);
      }}
    >
      {tree.map((item) => (item.type === "group" ? renderGroup(item) : renderOverlay(item.overlay, null)))}
      {dragging && (
        <li
          className={["root-end", hint?.kind === "end" ? "drop-into" : ""].join(" ")}
          onDragOver={(e) => over(e, { kind: "end" })}
          onDrop={drop}
        >
          Hier ablegen: ans Ende der Liste (aus Gruppe lösen)
        </li>
      )}
    </ul>
  );
}
