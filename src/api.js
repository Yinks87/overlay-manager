// Dünne Schicht über den Rust-Commands (src-tauri/src/commands.rs).
import { invoke } from "@tauri-apps/api/core";

export const api = {
  listOverlays: () => invoke("list_overlays"),
  getOpenOverlays: () => invoke("get_open_overlays"),
  getMaximizedOverlays: () => invoke("get_maximized_overlays"),
  toggleMaximized: (id) => invoke("toggle_overlay_maximized", { id }),
  createOverlay: (input) => invoke("create_overlay", { input }),
  duplicateOverlay: (id) => invoke("duplicate_overlay", { id }),
  updateOverlay: (id, input, resetScale = false) =>
    invoke("update_overlay", { id, input, resetScale }),
  deleteOverlay: (id) => invoke("delete_overlay", { id }),
  openOverlay: (id) => invoke("open_overlay", { id }),
  closeOverlay: (id) => invoke("close_overlay", { id }),
  setLocked: (id, locked) => invoke("set_overlay_locked", { id, locked }),
  setAudio: (id, volume, muted) => invoke("set_overlay_audio", { id, volume, muted }),
  setReference: (id) => invoke("set_overlay_reference", { id }),
  listGroups: () => invoke("list_groups"),
  createGroup: (name) => invoke("create_group", { name }),
  renameGroup: (id, name) => invoke("rename_group", { id, name }),
  setGroupCollapsed: (id, collapsed) => invoke("set_group_collapsed", { id, collapsed }),
  deleteGroup: (id) => invoke("delete_group", { id }),
  saveLayout: (layout) => invoke("save_layout", { layout }),
  setOverlaysOpen: (ids, open) => invoke("set_overlays_open", { ids, open }),
  getAppSettings: () => invoke("get_app_settings"),
  setCloseBehavior: (behavior) => invoke("set_close_behavior", { behavior }),
  setUpdateSettings: (autoCheck, autoInstall) =>
    invoke("set_update_settings", { autoCheck, autoInstall }),
};

export const NEW_OVERLAY = {
  name: "Neues Overlay",
  url: "https://example.com",
  x: 120,
  y: 120,
  width: 640,
  height: 360,
  locked: true, // neu = gesperrt/durchklickbar: blockiert nie den Bildschirm
  volume: 1,
  muted: false,
  transparentBg: true,
  borderEnabled: true, // Rahmen zeigt die Position; im Dashboard abschaltbar
  borderColor: "#ff3b6b",
  muteIndicator: false,
};
