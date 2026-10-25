use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Position/Größe sind physische Pixel (Fensterfläche).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overlay {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub locked: bool,
    pub volume: f64,
    pub muted: bool,
    pub transparent_bg: bool,
    pub border_enabled: bool,
    pub border_color: String,
    pub mute_indicator: bool,
    /// Zuletzt gespeicherter Maximiert-Zustand (wird beim Öffnen wiederhergestellt).
    pub maximized: bool,
    /// Aktiviert = Overlay war zuletzt geöffnet und startet mit der App.
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayInput {
    pub name: String,
    pub url: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub locked: bool,
    pub volume: f64,
    pub muted: bool,
    pub transparent_bg: bool,
    pub border_enabled: bool,
    pub border_color: String,
    pub mute_indicator: bool,
}

/// Position (äußere Fensterposition) und Größe (Innenfläche) des Dashboards in physischen Pixeln.
#[derive(Debug, Clone, Copy)]
pub struct DashboardGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

const OVERLAY_COLS: &str = "id,name,url,x,y,width,height,locked,volume,muted,transparent_bg,border_enabled,border_color,mute_indicator,maximized,enabled";

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         CREATE TABLE IF NOT EXISTS overlays (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            name           TEXT    NOT NULL,
            url            TEXT    NOT NULL,
            x              INTEGER NOT NULL DEFAULT 100,
            y              INTEGER NOT NULL DEFAULT 100,
            width          INTEGER NOT NULL DEFAULT 640,
            height         INTEGER NOT NULL DEFAULT 360,
            locked         INTEGER NOT NULL DEFAULT 1,
            volume         REAL    NOT NULL DEFAULT 1.0,
            muted          INTEGER NOT NULL DEFAULT 0,
            autostart      INTEGER NOT NULL DEFAULT 1,
            transparent_bg INTEGER NOT NULL DEFAULT 1,
            border_enabled INTEGER NOT NULL DEFAULT 0,
            border_color   TEXT    NOT NULL DEFAULT '#ff3b6b',
            mute_indicator INTEGER NOT NULL DEFAULT 0,
            maximized      INTEGER NOT NULL DEFAULT 0,
            enabled        INTEGER NOT NULL DEFAULT 0
         );
         
         CREATE TABLE IF NOT EXISTS app_settings (
            theme          TEXT    NOT NULL DEFAULT 'light',
            language       TEXT    NOT NULL DEFAULT 'de',
            position_x     INTEGER NOT NULL DEFAULT 100,
            position_y     INTEGER NOT NULL DEFAULT 100,
            size_width     INTEGER NOT NULL DEFAULT 800,
            size_height    INTEGER NOT NULL DEFAULT 600,
            close_behavior TEXT    NOT NULL DEFAULT 'exit',
            dashboard_saved INTEGER NOT NULL DEFAULT 0
         );",
    )?;
    // Migration für Datenbanken aus älteren Versionen (Fehler = Spalte existiert schon).
    // Zusätzliche, nicht mehr verwendete Spalten aus früheren Versionen stören nicht.
    for ddl in [
        "ALTER TABLE overlays ADD COLUMN border_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE overlays ADD COLUMN border_color TEXT NOT NULL DEFAULT '#ff3b6b'",
        "ALTER TABLE overlays ADD COLUMN mute_indicator INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE overlays ADD COLUMN maximized INTEGER NOT NULL DEFAULT 0",
    ] {
        let _ = conn.execute(ddl, []);
    }
    // „enabled“ löst das frühere „autostart“ ab; bestehende Werte werden einmalig übernommen.
    if conn
        .execute("ALTER TABLE overlays ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0", [])
        .is_ok()
    {
        let _ = conn.execute("UPDATE overlays SET enabled = autostart", []);
    }
    let _ = conn.execute(
        "ALTER TABLE app_settings ADD COLUMN close_behavior TEXT NOT NULL DEFAULT 'exit'",
        [],
    );
    // Bereits gespeicherte Dashboard-Geometrie (Zeile existiert) bleibt gültig.
    if conn
        .execute(
            "ALTER TABLE app_settings ADD COLUMN dashboard_saved INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .is_ok()
    {
        let _ = conn.execute("UPDATE app_settings SET dashboard_saved = 1", []);
    }
    // Es gibt genau eine Einstellungs-Zeile.
    conn.execute(
        "INSERT INTO app_settings (theme) SELECT 'light' WHERE NOT EXISTS (SELECT 1 FROM app_settings)",
        [],
    )?;
    Ok(conn)
}

fn map(r: &Row) -> rusqlite::Result<Overlay> {
    Ok(Overlay {
        id: r.get(0)?,
        name: r.get(1)?,
        url: r.get(2)?,
        x: r.get(3)?,
        y: r.get(4)?,
        width: r.get(5)?,
        height: r.get(6)?,
        locked: r.get(7)?,
        volume: r.get(8)?,
        muted: r.get(9)?,
        transparent_bg: r.get(10)?,
        border_enabled: r.get(11)?,
        border_color: r.get(12)?,
        mute_indicator: r.get(13)?,
        maximized: r.get(14)?,
        enabled: r.get(15)?,
    })
}

pub fn list(c: &Connection) -> rusqlite::Result<Vec<Overlay>> {
    let mut st = c.prepare(&format!("SELECT {OVERLAY_COLS} FROM overlays ORDER BY id"))?;
    let rows = st.query_map([], map)?;
    rows.collect()
}

pub fn get(c: &Connection, id: i64) -> rusqlite::Result<Option<Overlay>> {
    c.query_row(
        &format!("SELECT {OVERLAY_COLS} FROM overlays WHERE id = ?1"),
        [id],
        map,
    )
    .optional()
}

pub fn insert(c: &Connection, i: &OverlayInput) -> rusqlite::Result<i64> {
    c.execute(
        "INSERT INTO overlays (name,url,x,y,width,height,locked,volume,muted,transparent_bg,border_enabled,border_color,mute_indicator)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        params![i.name, i.url, i.x, i.y, i.width, i.height, i.locked, i.volume, i.muted, i.transparent_bg, i.border_enabled, i.border_color, i.mute_indicator],
    )?;
    Ok(c.last_insert_rowid())
}

pub fn update(c: &Connection, id: i64, i: &OverlayInput) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET name=?2,url=?3,x=?4,y=?5,width=?6,height=?7,locked=?8,
                volume=?9,muted=?10,transparent_bg=?11,border_enabled=?12,border_color=?13,mute_indicator=?14 WHERE id=?1",
        params![id, i.name, i.url, i.x, i.y, i.width, i.height, i.locked, i.volume, i.muted, i.transparent_bg, i.border_enabled, i.border_color, i.mute_indicator],
    )?;
    Ok(())
}

pub fn delete(c: &Connection, id: i64) -> rusqlite::Result<()> {
    c.execute("DELETE FROM overlays WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_geometry(
    c: &Connection,
    id: i64,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET x=?2,y=?3,width=?4,height=?5 WHERE id=?1",
        params![id, x, y, w, h],
    )?;
    Ok(())
}

pub fn set_locked(c: &Connection, id: i64, locked: bool) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET locked=?2 WHERE id=?1",
        params![id, locked],
    )?;
    Ok(())
}

pub fn set_audio(c: &Connection, id: i64, volume: f64, muted: bool) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET volume=?2,muted=?3 WHERE id=?1",
        params![id, volume, muted],
    )?;
    Ok(())
}

pub fn set_maximized(c: &Connection, id: i64, maximized: bool) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET maximized=?2 WHERE id=?1",
        params![id, maximized],
    )?;
    Ok(())
}

pub fn set_enabled(c: &Connection, id: i64, enabled: bool) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET enabled=?2 WHERE id=?1",
        params![id, enabled],
    )?;
    Ok(())
}

/// `None`, solange noch nie eine Dashboard-Geometrie gespeichert wurde.
pub fn get_dashboard_geometry(c: &Connection) -> rusqlite::Result<Option<DashboardGeometry>> {
    c.query_row(
        "SELECT position_x,position_y,size_width,size_height FROM app_settings WHERE dashboard_saved=1 LIMIT 1",
        [],
        |r| {
            Ok(DashboardGeometry {
                x: r.get(0)?,
                y: r.get(1)?,
                width: r.get(2)?,
                height: r.get(3)?,
            })
        },
    )
    .optional()
}

pub fn save_dashboard_geometry(c: &Connection, g: DashboardGeometry) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE app_settings SET position_x=?1,position_y=?2,size_width=?3,size_height=?4,dashboard_saved=1",
        params![g.x, g.y, g.width, g.height],
    )?;
    Ok(())
}

/// Verhalten beim Schließen des Hauptfensters.
pub const CLOSE_EXIT: &str = "exit";
pub const CLOSE_MINIMIZE: &str = "minimize";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub close_behavior: String,
}

pub fn get_app_settings(c: &Connection) -> rusqlite::Result<AppSettings> {
    let close_behavior = c
        .query_row("SELECT close_behavior FROM app_settings LIMIT 1", [], |r| r.get(0))
        .optional()?
        .unwrap_or_else(|| CLOSE_EXIT.to_string());
    Ok(AppSettings { close_behavior })
}

pub fn set_close_behavior(c: &Connection, behavior: &str) -> rusqlite::Result<()> {
    c.execute("UPDATE app_settings SET close_behavior=?1", [behavior])?;
    Ok(())
}
