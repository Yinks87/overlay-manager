use crate::{
    db::{self, Group, LayoutItem, Overlay, OverlayInput},
    overlay, AppState,
};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, State};

type Res<T> = Result<T, String>;

fn es<E: ToString>(e: E) -> String {
    e.to_string()
}

/// Kurzer DB-Zugriff; der Lock wird vor der Rückgabe wieder freigegeben.
fn with_db<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&Connection) -> rusqlite::Result<T>,
) -> Res<T> {
    let conn = state.db.lock().map_err(es)?;
    let result = f(&conn).map_err(es);
    result
}

fn fetch(state: &State<'_, AppState>, id: i64) -> Res<Overlay> {
    with_db(state, |c| db::get(c, id))?.ok_or_else(|| "Overlay nicht gefunden".to_string())
}

fn normalize(mut i: OverlayInput) -> Res<OverlayInput> {
    i.name = i.name.trim().to_string();
    if i.name.is_empty() {
        return Err("Bitte einen Namen eingeben.".into());
    }
    let raw = i.url.trim();
    let with_scheme = if raw.contains("://") { raw.to_string() } else { format!("https://{raw}") };
    let parsed: tauri::Url = with_scheme.parse().map_err(|e| format!("Ungültige URL: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Es sind nur http- und https-Adressen erlaubt.".into());
    }
    i.url = parsed.to_string();
    i.volume = i.volume.clamp(0.0, 1.0);
    let c = i.border_color.trim();
    let valid = c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    i.border_color = if valid { c.to_lowercase() } else { "#ff3b6b".to_string() };
    i.width = i.width.max(overlay::MIN_SIZE);
    i.height = i.height.max(overlay::MIN_SIZE);
    Ok(i)
}

#[tauri::command]
pub async fn list_overlays(state: State<'_, AppState>) -> Res<Vec<Overlay>> {
    with_db(&state, db::list)
}

#[tauri::command]
pub fn get_open_overlays(app: AppHandle) -> Vec<i64> {
    app.webview_windows()
        .keys()
        .filter_map(|l| overlay::id_from_label(l))
        .collect()
}

#[tauri::command]
pub async fn create_overlay(state: State<'_, AppState>, input: OverlayInput) -> Res<Overlay> {
    let input = normalize(input)?;
    let id = with_db(&state, |c| db::insert(c, &input))?;
    fetch(&state, id)
}

#[tauri::command]
pub async fn duplicate_overlay(state: State<'_, AppState>, id: i64) -> Res<Overlay> {
    let src = fetch(&state, id)?;
    const OFFSET: i32 = 40;
    let input = OverlayInput {
        name: format!("{} (Kopie)", src.name),
        url: src.url.clone(),
        x: src.x.saturating_add(OFFSET),
        y: src.y.saturating_add(OFFSET),
        width: src.width,
        height: src.height,
        locked: true,
        volume: src.volume,
        muted: src.muted,
        transparent_bg: src.transparent_bg,
        border_enabled: src.border_enabled,
        border_color: src.border_color.clone(),
        mute_indicator: src.mute_indicator,
    };
    let new_id = with_db(&state, |c| {
        let new_id = db::insert(c, &input)?;
        db::set_base_size(c, new_id, src.base_width, src.base_height)?;
        Ok(new_id)
    })?;
    fetch(&state, new_id)
}

#[tauri::command]
pub async fn update_overlay(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    input: OverlayInput,
    reset_scale: Option<bool>,
) -> Res<Overlay> {
    let input = normalize(input)?;
    let old = fetch(&state, id)?;
    with_db(&state, |c| db::update(c, id, &input))?;
    if reset_scale.unwrap_or(false) {
        // Gespeicherte Größe wird zur Referenz = 100 % Skalierung.
        with_db(&state, |c| db::set_base_size(c, id, input.width, input.height))?;
    }
    let ov = fetch(&state, id)?;
    if let Some(win) = app.get_webview_window(&overlay::label(id)) {
        overlay::sync(&win, &ov)?;
        overlay::reload(&win, &ov.url, old.url != ov.url);
    }
    Ok(ov)
}

#[tauri::command]
pub async fn delete_overlay(app: AppHandle, state: State<'_, AppState>, id: i64) -> Res<()> {
    if let Some(win) = app.get_webview_window(&overlay::label(id)) {
        let _ = win.destroy();
    }
    with_db(&state, |c| db::delete(c, id))
}

// Fenster-Erzeugung nur in async-Commands (in sync-Commands droht unter Windows ein Deadlock).
#[tauri::command]
pub async fn open_overlay(app: AppHandle, state: State<'_, AppState>, id: i64) -> Res<()> {
    let ov = fetch(&state, id)?;
    overlay::open(&app, &ov)?;
    with_db(&state, |c| db::set_enabled(c, id, true))
}

#[tauri::command]
pub async fn close_overlay(app: AppHandle, state: State<'_, AppState>, id: i64) -> Res<()> {
    if let Some(win) = app.get_webview_window(&overlay::label(id)) {
        win.destroy().map_err(es)?;
    }
    with_db(&state, |c| db::set_enabled(c, id, false))
}

#[tauri::command]
pub async fn set_overlay_locked(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    locked: bool,
) -> Res<()> {
    with_db(&state, |c| db::set_locked(c, id, locked))?;
    let mut ov = fetch(&state, id)?;
    // Im Bearbeitungsmodus nicht maximiert bleiben (sonst blockiert das Overlay den Bildschirm).
    if !locked && ov.maximized {
        with_db(&state, |c| db::set_maximized(c, id, false))?;
        ov.maximized = false;
    }
    if let Some(win) = app.get_webview_window(&overlay::label(id)) {
        if !locked && overlay::is_maximized(&app, id) {
            overlay::set_maximized(&win, &ov, false)?;
        }
        overlay::sync(&win, &ov)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_overlay_audio(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    volume: f64,
    muted: bool,
) -> Res<()> {
    let volume = volume.clamp(0.0, 1.0);
    with_db(&state, |c| db::set_audio(c, id, volume, muted))?;
    if let Some(win) = app.get_webview_window(&overlay::label(id)) {
        let ov = fetch(&state, id)?;
        let _ = win.eval(overlay::config_js(&ov));
    }
    Ok(())
}

/// Aktuelle Fenstergröße (bzw. die gespeicherte Größe, falls geschlossen oder maximiert)
/// als Referenz für 100 % Zoom festlegen.
#[tauri::command]
pub async fn set_overlay_reference(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Res<Overlay> {
    let ov = fetch(&state, id)?;
    let win = app.get_webview_window(&overlay::label(id));
    let live = win
        .as_ref()
        .filter(|_| !overlay::is_maximized(&app, id))
        .and_then(|w| w.inner_size().ok());
    let (w, h) = live.map_or((ov.width, ov.height), |s| (s.width, s.height));
    let (w, h) = (w.max(overlay::MIN_SIZE), h.max(overlay::MIN_SIZE));
    with_db(&state, |c| db::set_base_size(c, id, w, h))?;
    let ov = fetch(&state, id)?;
    overlay::remember_base(&app, &ov);
    if let Some(win) = win {
        overlay::apply_zoom(&win);
    }
    Ok(ov)
}

#[tauri::command]
pub async fn list_groups(state: State<'_, AppState>) -> Res<Vec<Group>> {
    with_db(&state, db::list_groups)
}

#[tauri::command]
pub async fn create_group(state: State<'_, AppState>, name: String) -> Res<Group> {
    let name = name.trim();
    let name = if name.is_empty() { "Neue Gruppe" } else { name };
    let id = with_db(&state, |c| db::insert_group(c, name))?;
    with_db(&state, |c| db::get_group(c, id))?.ok_or_else(|| "Gruppe nicht gefunden".to_string())
}

#[tauri::command]
pub async fn rename_group(state: State<'_, AppState>, id: i64, name: String) -> Res<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Bitte einen Namen eingeben.".into());
    }
    with_db(&state, |c| db::rename_group(c, id, name))
}

#[tauri::command]
pub async fn set_group_collapsed(state: State<'_, AppState>, id: i64, collapsed: bool) -> Res<()> {
    with_db(&state, |c| db::set_group_collapsed(c, id, collapsed))
}

/// Löscht nur die Gruppe, ihre Overlays bleiben erhalten.
#[tauri::command]
pub async fn delete_group(state: State<'_, AppState>, id: i64) -> Res<()> {
    with_db(&state, |c| db::delete_group(c, id))
}

#[tauri::command]
pub async fn save_layout(state: State<'_, AppState>, layout: Vec<LayoutItem>) -> Res<()> {
    with_db(&state, |c| db::save_layout(c, &layout))
}

#[tauri::command]
pub async fn set_overlays_open(
    app: AppHandle,
    state: State<'_, AppState>,
    ids: Vec<i64>,
    open: bool,
) -> Res<()> {
    let mut first_error: Option<String> = None;
    for id in ids {
        let result = if open {
            match fetch(&state, id) {
                Ok(ov) => overlay::open(&app, &ov),
                Err(e) => Err(e),
            }
        } else {
            match app.get_webview_window(&overlay::label(id)) {
                Some(win) => win.destroy().map_err(es),
                None => Ok(()),
            }
        };
        match result {
            Ok(()) => {
                let _ = with_db(&state, |c| db::set_enabled(c, id, open));
            }
            Err(e) => {
                first_error.get_or_insert(e);
            }
        }
    }
    let _ = app.emit("overlays-changed", ());
    first_error.map_or(Ok(()), Err)
}

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Res<db::AppSettings> {
    with_db(&state, db::get_app_settings)
}

#[tauri::command]
pub async fn set_close_behavior(state: State<'_, AppState>, behavior: String) -> Res<()> {
    if behavior != db::CLOSE_EXIT && behavior != db::CLOSE_MINIMIZE {
        return Err("Ungültiger Wert für das Schließverhalten.".into());
    }
    with_db(&state, |c| db::set_close_behavior(c, &behavior))
}

#[tauri::command]
pub async fn set_update_settings(
    state: State<'_, AppState>,
    auto_check: bool,
    auto_install: bool,
) -> Res<()> {
    // Automatisches Installieren setzt die automatische Prüfung voraus.
    with_db(&state, |c| db::set_update_settings(c, auto_check, auto_check && auto_install))
}

#[tauri::command]
pub fn get_maximized_overlays(app: AppHandle) -> Vec<i64> {
    overlay::maximized_ids(&app)
}

/// Maximieren/Wiederherstellen. Beim Maximieren wird das Overlay automatisch gesperrt
/// (durchklickbar), damit es das Dashboard nicht verdeckt und blockiert.
#[tauri::command]
pub async fn toggle_overlay_maximized(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Res<bool> {
    let win = app
        .get_webview_window(&overlay::label(id))
        .ok_or_else(|| "Das Overlay ist nicht geöffnet.".to_string())?;
    let mut ov = fetch(&state, id)?;
    if overlay::is_maximized(&app, id) {
        overlay::set_maximized(&win, &ov, false)?;
        return Ok(false);
    }
    if !ov.locked {
        with_db(&state, |c| db::set_locked(c, id, true))?;
        ov = fetch(&state, id)?;
        overlay::apply_mode(&win, &ov)?;
    }
    overlay::set_maximized(&win, &ov, true)?;
    Ok(true)
}
