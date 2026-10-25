use crate::{db, db::Overlay, AppState};
use tauri::{
    webview::PageLoadEvent, AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window,
};

const INJECT: &str = include_str!("inject.js");
const PREFIX: &str = "overlay-";

fn es<E: ToString>(e: E) -> String {
    e.to_string()
}

fn js_str(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into())
}

pub fn label(id: i64) -> String {
    format!("{PREFIX}{id}")
}

pub fn id_from_label(label: &str) -> Option<i64> {
    label.strip_prefix(PREFIX)?.parse().ok()
}

/// JS, das beim Dokumentstart in jeden Frame injiziert wird
/// (Audio, Transparenz, farbiger Rahmen, Verschiebe-/Skalier-Bedienelemente, Stumm-Symbol).
fn init_script(ov: &Overlay) -> String {
    INJECT
        .replace("__VOLUME__", &ov.volume.to_string())
        .replace("__MUTED__", &ov.muted.to_string())
        .replace("__TRANSPARENT__", &ov.transparent_bg.to_string())
        .replace("__EDIT__", &(!ov.locked).to_string())
        .replace("__BORDER_COLOR__", &js_str(&ov.border_color))
        .replace("__MUTE_ICON__", &ov.mute_indicator.to_string())
        .replace("__BORDER__", &ov.border_enabled.to_string())
        .replace("__LABEL__", &js_str(&label(ov.id)))
        .replace("__NAME__", &js_str(&ov.name))
}

/// JS-Aufruf, um die Einstellungen zur Laufzeit in die Seite zu pushen.
pub fn config_js(ov: &Overlay) -> String {
    format!(
        "window.__overlayConfig&&window.__overlayConfig({{volume:{},muted:{},transparent:{},edit:{},border:{},borderColor:{},muteIcon:{},name:{}}})",
        ov.volume,
        ov.muted,
        ov.transparent_bg,
        !ov.locked,
        ov.border_enabled,
        js_str(&ov.border_color),
        ov.mute_indicator,
        js_str(&ov.name)
    )
}

pub fn is_maximized(app: &AppHandle, id: i64) -> bool {
    app.state::<AppState>()
        .maximized
        .lock()
        .map(|s| s.contains(&id))
        .unwrap_or(false)
}

pub fn maximized_ids(app: &AppHandle) -> Vec<i64> {
    app.state::<AppState>()
        .maximized
        .lock()
        .map(|s| s.iter().copied().collect())
        .unwrap_or_default()
}

/// Aufräumen, wenn ein Overlay-Fenster zerstört wurde.
pub fn forget(app: &AppHandle, label: &str) {
    if let Some(id) = id_from_label(label) {
        let state = app.state::<AppState>();
        if let Ok(mut s) = state.maximized.lock() {
            s.remove(&id);
        };
    }
}

/// Öffnet das Overlay-Fenster (oder zeigt es, falls schon vorhanden).
/// Das Fenster hat NIE einen nativen Rahmen / eine Titelleiste.
pub fn open(app: &AppHandle, ov: &Overlay) -> Result<(), String> {
    let label = label(ov.id);
    if let Some(w) = app.get_webview_window(&label) {
        w.show().map_err(es)?;
        return Ok(());
    }

    let url: tauri::Url = ov.url.parse().map_err(|e| format!("Ungültige URL: {e}"))?;
    let id = ov.id;

    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(ov.name.clone())
        .decorations(false) // niemals Rahmen/Titelleiste/X
        .resizable(!ov.locked) // nur im Bearbeitungsmodus skalierbar
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .minimizable(false)
        .maximizable(false)
        .min_inner_size(120.0, 60.0)
        .visible(false) // erst nach Positionierung anzeigen
        .focused(false)
        .initialization_script(init_script(ov))
        // Nach jedem (Re-)Load die aktuellen Werte aus der DB einspielen.
        .on_page_load(move |w, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                let app = w.app_handle();
                let state = app.state::<AppState>();
                let current = state
                    .db
                    .lock()
                    .ok()
                    .and_then(|c| db::get(&c, id).ok().flatten());
                if let Some(ov) = current {
                    let _ = w.eval(config_js(&ov));
                }
            }
        })
        .build()
        .map_err(es)?;

    place(&win, ov);
    apply_mode(&win, ov)?;
    // Zuletzt maximierte Overlays starten wieder maximiert (nur gesperrt möglich).
    if ov.maximized && ov.locked {
        let _ = set_maximized(&win, ov, true);
    }
    win.show().map_err(es)?;
    // Nach dem Anzeigen noch einmal setzen, damit Click-Through sicher aktiv ist.
    apply_mode(&win, ov)?;
    let _ = app.emit("overlays-changed", ());
    Ok(())
}

/// Betriebsmodus anwenden:
///  gesperrt (locked)  → nicht skalierbar, **Mausklicks gehen durch das Fenster**
///  Bearbeitungsmodus  → skalierbar, Mausereignisse aktiv; die Seite blendet einen
///                       Verschiebe-Balken und Anfasser ein (inject.js)
pub fn apply_mode(win: &WebviewWindow, ov: &Overlay) -> Result<(), String> {
    win.set_decorations(false).map_err(es)?;
    win.set_resizable(!ov.locked).map_err(es)?;
    win.set_ignore_cursor_events(ov.locked).map_err(es)?; // <- Click-Through
    win.set_always_on_top(true).map_err(es)?;
    let _ = win.eval(config_js(ov));
    Ok(())
}

/// Setzt Position und Größe (physische Pixel).
pub fn place(win: &WebviewWindow, ov: &Overlay) {
    let _ = win.set_size(PhysicalSize::new(ov.width, ov.height));
    // Falls Windows einen unsichtbaren Rand liefert, Client-Fläche exakt auf x/y ausrichten.
    let (dx, dy) = client_offset(win);
    let _ = win.set_position(PhysicalPosition::new(ov.x - dx, ov.y - dy));
}

/// Abstand zwischen Außenposition des Fensters und Beginn der Webview-Fläche.
fn client_offset(win: &WebviewWindow) -> (i32, i32) {
    match (win.inner_position(), win.outer_position()) {
        (Ok(i), Ok(o)) => (i.x - o.x, i.y - o.y),
        _ => (0, 0),
    }
}

/// Maximieren = Overlay füllt den Monitor, auf dem es liegt. Die gespeicherte
/// Position/Größe in der DB bleibt dabei unverändert.
pub fn set_maximized(win: &WebviewWindow, ov: &Overlay, on: bool) -> Result<(), String> {
    let app = win.app_handle();
    let state = app.state::<AppState>();
    if on {
        let mon = win
            .current_monitor()
            .map_err(es)?
            .ok_or_else(|| "Kein Monitor gefunden".to_string())?;
        let (p, s) = (*mon.position(), *mon.size());
        state.maximized.lock().map_err(es)?.insert(ov.id);
        let _ = win.set_size(PhysicalSize::new(s.width, s.height));
        let (dx, dy) = client_offset(win);
        let _ = win.set_position(PhysicalPosition::new(p.x - dx, p.y - dy));
    } else {
        state.maximized.lock().map_err(es)?.remove(&ov.id);
        place(win, ov);
    }
    if let Ok(conn) = state.db.lock() {
        let _ = db::set_maximized(&conn, ov.id, on);
    }
    let _ = app.emit("overlays-changed", ());
    Ok(())
}

/// Gespeicherte Einstellungen live auf ein offenes Fenster anwenden (ohne Neuladen).
pub fn sync(win: &WebviewWindow, ov: &Overlay) -> Result<(), String> {
    win.set_title(&ov.name).map_err(es)?;
    apply_mode(win, ov)?;
    if !is_maximized(win.app_handle(), ov.id) {
        place(win, ov);
    }
    Ok(())
}

/// Seite neu laden (bei geänderter URL: neue Adresse laden).
pub fn reload(win: &WebviewWindow, url: &str, url_changed: bool) {
    if url_changed {
        if let Ok(js) = serde_json::to_string(url) {
            let _ = win.eval(format!("window.location.replace({js})"));
        }
    } else {
        let _ = win.eval("window.location.reload()");
    }
}

/// Wird bei Moved/Resized aufgerufen. Gespeichert wird nur im Bearbeitungsmodus
/// (Fenster skalierbar) und nicht, solange das Overlay maximiert ist.
pub fn persist_geometry(window: &Window) {
    if !window.is_resizable().unwrap_or(false) {
        return;
    }
    let Some(id) = id_from_label(window.label()) else { return };
    let (Ok(p), Ok(s)) = (window.inner_position(), window.inner_size()) else { return };
    if p.x < -10_000 || p.y < -10_000 || s.width == 0 || s.height == 0 {
        return;
    }
    let app = window.app_handle();
    let state = app.state::<AppState>();
    // try_lock: im Main-Thread nie blockieren.
    let maximized = match state.maximized.try_lock() {
        Ok(set) => set.contains(&id),
        Err(_) => true,
    };
    if maximized {
        return;
    }
    let Ok(conn) = state.db.try_lock() else { return };
    if db::save_geometry(&conn, id, p.x, p.y, s.width, s.height).is_ok() {
        drop(conn);
        let _ = app.emit(
            "overlay-geometry",
            serde_json::json!({ "id": id, "x": p.x, "y": p.y, "width": s.width, "height": s.height }),
        );
    }
}
