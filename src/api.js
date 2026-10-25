// Dünne Schicht über den Rust-Commands (src-tauri/src/commands.rs).
import { invoke } from "@tauri-apps/api/core";

export const api = {
  listOverlays: () => invoke("list_overlays"),
  getOpenOverlays: () => invoke("get_open_overlays"),
  getMaximizedOverlays: () => invoke("get_maximized_overlays"),
  toggleMaximized: (id) => invoke("toggle_overlay_maximized", { id }),
  createOverlay: (input) => invoke("create_overlay", { input }),
  updateOverlay: (id, input) => invoke("update_overlay", { id, input }),
  deleteOverlay: (id) => invoke("delete_overlay", { id }),
  openOverlay: (id) => invoke("open_overlay", { id }),
  closeOverlay: (id) => invoke("close_overlay", { id }),
  setLocked: (id, locked) => invoke("set_overlay_locked", { id, locked }),
  setAudio: (id, volume, muted) => invoke("set_overlay_audio", { id, volume, muted }),
  getAppSettings: () => invoke("get_app_settings"),
  setCloseBehavior: (behavior) => invoke("set_close_behavior", { behavior }),
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
