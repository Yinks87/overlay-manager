mod commands;
mod db;
mod overlay;

use std::{collections::HashSet, sync::Mutex};
use tauri::{Emitter, Manager, WindowEvent};

/// Geteilter App-Zustand. WICHTIG: Den DB-Lock nie halten, während Fenster-APIs
/// aufgerufen werden – Fenster-Events laufen im Main-Thread und wollen ebenfalls
/// auf die DB zugreifen (Deadlock-Gefahr).
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    /// IDs der Overlays, die gerade auf Monitorgröße maximiert sind.
    pub maximized: Mutex<HashSet<i64>>,
}

const DASHBOARD_MIN: (u32, u32) = (860, 560);

/// Gespeicherte Position/Größe des Dashboards anwenden. Liegt die Position auf keinem
/// angeschlossenen Monitor mehr, bleibt das Fenster an der Standardposition.
fn restore_dashboard(win: &tauri::WebviewWindow, g: db::DashboardGeometry) {
    let width = g.width.max(DASHBOARD_MIN.0);
    let height = g.height.max(DASHBOARD_MIN.1);
    let _ = win.set_size(tauri::PhysicalSize::new(width, height));
    let on_screen = win.available_monitors().unwrap_or_default().iter().any(|m| {
        let (p, s) = (m.position(), m.size());
        g.x >= p.x
            && g.y >= p.y
            && g.x < p.x + s.width as i32 - 100
            && g.y < p.y + s.height as i32 - 100
    });
    if on_screen {
        let _ = win.set_position(tauri::PhysicalPosition::new(g.x, g.y));
    }
}

/// Wird bei Moved/Resized des Hauptfensters aufgerufen (nie im Main-Thread blockieren).
fn persist_dashboard(window: &tauri::Window) {
    if window.is_minimized().unwrap_or(false)
        || window.is_maximized().unwrap_or(false)
        || window.is_fullscreen().unwrap_or(false)
    {
        return;
    }
    let (Ok(p), Ok(s)) = (window.outer_position(), window.inner_size()) else { return };
    if p.x < -10_000 || p.y < -10_000 || s.width == 0 || s.height == 0 {
        return;
    }
    let app = window.app_handle();
    let Some(state) = app.try_state::<AppState>() else { return };
    let Ok(conn) = state.db.try_lock() else { return };
    let _ = db::save_dashboard_geometry(
        &conn,
        db::DashboardGeometry { x: p.x, y: p.y, width: s.width, height: s.height },
    );
}

/// Liest das Schließverhalten (try_lock: im Main-Thread nie blockieren; Fallback = beenden).
fn minimize_on_close(app: &tauri::AppHandle) -> bool {
    let Some(state) = app.try_state::<AppState>() else { return false };
    let Ok(conn) = state.db.try_lock() else { return false };
    db::get_app_settings(&conn)
        .map(|s| s.close_behavior == db::CLOSE_MINIMIZE)
        .unwrap_or(false)
}

const TRAY_ID: &str = "main-tray";

/// Dashboard wieder anzeigen und das Tray-Symbol ausblenden.
fn show_dashboard(app: &tauri::AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(false);
    }
}

/// Dashboard ausblenden (weder Fenster noch Taskleiste) und Tray-Symbol zeigen.
fn hide_to_tray(window: &tauri::Window) {
    let _ = window.hide();
    if let Some(tray) = window.app_handle().tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(true);
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };
    let open = MenuItem::with_id(app, "tray-open", "Dashboard öffnen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Overlay Manager")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => show_dashboard(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_dashboard(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let tray = builder.build(app)?;
    // Das Symbol erscheint nur, solange das Dashboard im Tray versteckt ist.
    tray.set_visible(false)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // Muss als erstes Plugin registriert werden: zweiter Start holt das Dashboard nach vorn.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_dashboard(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            build_tray(app)?;
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("overlays.db"))?;

            let autostart: Vec<_> = db::list(&conn)?
                .into_iter()
                .filter(|o| o.enabled)
                .collect();
            let dashboard = db::get_dashboard_geometry(&conn)?;

            app.manage(AppState {
                db: Mutex::new(conn),
                maximized: Mutex::new(HashSet::new()),
            });

            if let (Some(g), Some(main)) = (dashboard, app.get_webview_window("main")) {
                restore_dashboard(&main, g);
            }

            // Aktivierte Overlays direkt beim App-Start öffnen.
            for ov in autostart {
                if let Err(e) = overlay::open(app.handle(), &ov) {
                    eprintln!("Overlay '{}' konnte nicht gestartet werden: {e}", ov.name);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label().to_string();
            match event {
                // Schließt man das Hauptfenster, wird die ganze App (inkl. Overlays) beendet.
                WindowEvent::CloseRequested { api, .. } if label == "main" => {
                    if minimize_on_close(window.app_handle()) {
                        api.prevent_close();
                        hide_to_tray(window);
                    } else {
                        window.app_handle().exit(0);
                    }
                }
                // Position/Größe des Dashboards speichern.
                WindowEvent::Moved(_) | WindowEvent::Resized(_) if label == "main" => {
                    persist_dashboard(window);
                }
                // Position/Größe im Bearbeitungsmodus automatisch speichern.
                WindowEvent::Moved(_) | WindowEvent::Resized(_)
                    if overlay::id_from_label(&label).is_some() =>
                {
                    overlay::persist_geometry(window);
                }
                WindowEvent::Destroyed if overlay::id_from_label(&label).is_some() => {
                    overlay::forget(window.app_handle(), &label);
                    let _ = window.app_handle().emit("overlays-changed", ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_overlays,
            commands::get_open_overlays,
            commands::create_overlay,
            commands::update_overlay,
            commands::delete_overlay,
            commands::open_overlay,
            commands::close_overlay,
            commands::set_overlay_locked,
            commands::set_overlay_audio,
            commands::get_maximized_overlays,
            commands::get_app_settings,
            commands::set_close_behavior,
            commands::toggle_overlay_maximized,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
