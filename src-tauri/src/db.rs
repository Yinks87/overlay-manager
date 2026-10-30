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
    pub maximized: bool,
    pub enabled: bool,
    pub base_width: u32,
    pub base_height: u32,
    pub group_id: Option<i64>,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub position: i64,
    pub collapsed: bool,
}

/// Eintrag der Listenstruktur: Overlay auf oberster Ebene oder Gruppe mit ihren Overlays.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum LayoutItem {
    Overlay { id: i64 },
    Group { id: i64, children: Vec<i64> },
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

const OVERLAY_COLS: &str = "id,name,url,x,y,width,height,locked,volume,muted,transparent_bg,border_enabled,border_color,mute_indicator,maximized,enabled,base_width,base_height,group_id,position";

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
            mute_indicator INTEGER NOT NULL DEFAULT 1,
            maximized      INTEGER NOT NULL DEFAULT 0,
            enabled        INTEGER NOT NULL DEFAULT 0,
            base_width     INTEGER NOT NULL DEFAULT 640,
            base_height    INTEGER NOT NULL DEFAULT 360,
            group_id       INTEGER,
            position       INTEGER NOT NULL DEFAULT 0
         );

         CREATE TABLE IF NOT EXISTS groups (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            position  INTEGER NOT NULL DEFAULT 0,
            collapsed INTEGER NOT NULL DEFAULT 0
         );
         
         CREATE TABLE IF NOT EXISTS app_settings (
            theme          TEXT    NOT NULL DEFAULT 'light',
            language       TEXT    NOT NULL DEFAULT 'de',
            position_x     INTEGER NOT NULL DEFAULT 100,
            position_y     INTEGER NOT NULL DEFAULT 100,
            size_width     INTEGER NOT NULL DEFAULT 800,
            size_height    INTEGER NOT NULL DEFAULT 600,
            close_behavior TEXT    NOT NULL DEFAULT 'exit',
            dashboard_saved INTEGER NOT NULL DEFAULT 0,
            auto_check_updates   INTEGER NOT NULL DEFAULT 1,
            auto_install_updates INTEGER NOT NULL DEFAULT 1
         );",
    )?;
    // Migration für Datenbanken aus älteren Versionen (Fehler = Spalte existiert schon).
    // Zusätzliche, nicht mehr verwendete Spalten aus früheren Versionen stören nicht.
    for ddl in [
        "ALTER TABLE overlays ADD COLUMN border_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE overlays ADD COLUMN border_color TEXT NOT NULL DEFAULT '#ff3b6b'",
        "ALTER TABLE overlays ADD COLUMN mute_indicator INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE overlays ADD COLUMN maximized INTEGER NOT NULL DEFAULT 0",
    ] {
        let _ = conn.execute(ddl, []);
    }
    // „enabled“ löst das frühere „autostart“ ab; bestehende Werte werden einmalig übernommen.
    if conn
        .execute(
            "ALTER TABLE overlays ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .is_ok()
    {
        let _ = conn.execute("UPDATE overlays SET enabled = autostart", []);
    }
    let _ = conn.execute(
        "ALTER TABLE app_settings ADD COLUMN close_behavior TEXT NOT NULL DEFAULT 'exit'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE app_settings ADD COLUMN auto_check_updates INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE app_settings ADD COLUMN auto_install_updates INTEGER NOT NULL DEFAULT 1",
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
    // Referenzgröße für den Zoom: bestehende Overlays behalten ihre aktuelle Größe als 100 %.
    if conn
        .execute(
            "ALTER TABLE overlays ADD COLUMN base_width INTEGER NOT NULL DEFAULT 640",
            [],
        )
        .is_ok()
    {
        let _ = conn.execute(
            "ALTER TABLE overlays ADD COLUMN base_height INTEGER NOT NULL DEFAULT 360",
            [],
        );
        let _ = conn.execute(
            "UPDATE overlays SET base_width = width, base_height = height",
            [],
        );
    }
    // Gruppen: bestehende Overlays behalten ihre bisherige Reihenfolge (nach id).
    let _ = conn.execute("ALTER TABLE overlays ADD COLUMN group_id INTEGER", []);
    if conn
        .execute(
            "ALTER TABLE overlays ADD COLUMN position INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .is_ok()
    {
        let _ = conn.execute("UPDATE overlays SET position = id", []);
    }
    // Mindestgröße der Overlay-Fenster (siehe overlay::MIN_SIZE).
    conn.execute(
        "UPDATE overlays SET width = MAX(width, 200), height = MAX(height, 200),
                base_width = MAX(base_width, 200), base_height = MAX(base_height, 200)",
        [],
    )?;
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
        base_width: r.get(16)?,
        base_height: r.get(17)?,
        group_id: r.get(18)?,
        position: r.get(19)?,
    })
}

pub fn list(c: &Connection) -> rusqlite::Result<Vec<Overlay>> {
    let mut st = c.prepare(&format!(
        "SELECT {OVERLAY_COLS} FROM overlays ORDER BY position, id"
    ))?;
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

fn next_root_position(c: &Connection) -> rusqlite::Result<i64> {
    c.query_row(
        "SELECT COALESCE(MAX(p), -1) + 1 FROM
           (SELECT position AS p FROM overlays WHERE group_id IS NULL
            UNION ALL SELECT position FROM groups)",
        [],
        |r| r.get(0),
    )
}

pub fn insert(c: &Connection, i: &OverlayInput) -> rusqlite::Result<i64> {
    let position = next_root_position(c)?;
    c.execute(
        "INSERT INTO overlays (name,url,x,y,width,height,locked,volume,muted,transparent_bg,border_enabled,border_color,mute_indicator,base_width,base_height,position)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?5,?6,?14)",
        params![i.name, i.url, i.x, i.y, i.width, i.height, i.locked, i.volume, i.muted, i.transparent_bg, i.border_enabled, i.border_color, i.mute_indicator, position],
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

pub fn set_base_size(c: &Connection, id: i64, w: u32, h: u32) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE overlays SET base_width=?2,base_height=?3 WHERE id=?1",
        params![id, w, h],
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
    pub auto_check_updates: bool,
    pub auto_install_updates: bool,
}

pub fn get_app_settings(c: &Connection) -> rusqlite::Result<AppSettings> {
    let settings = c
        .query_row(
            "SELECT close_behavior,auto_check_updates,auto_install_updates FROM app_settings LIMIT 1",
            [],
            |r| {
                Ok(AppSettings {
                    close_behavior: r.get(0)?,
                    auto_check_updates: r.get(1)?,
                    auto_install_updates: r.get(2)?,
                })
            },
        )
        .optional()?;
    Ok(settings.unwrap_or(AppSettings {
        close_behavior: CLOSE_EXIT.to_string(),
        auto_check_updates: false,
        auto_install_updates: false,
    }))
}

pub fn set_close_behavior(c: &Connection, behavior: &str) -> rusqlite::Result<()> {
    c.execute("UPDATE app_settings SET close_behavior=?1", [behavior])?;
    Ok(())
}

pub fn set_update_settings(
    c: &Connection,
    auto_check: bool,
    auto_install: bool,
) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE app_settings SET auto_check_updates=?1,auto_install_updates=?2",
        params![auto_check, auto_install],
    )?;
    Ok(())
}

pub fn list_groups(c: &Connection) -> rusqlite::Result<Vec<Group>> {
    let mut st =
        c.prepare("SELECT id,name,position,collapsed FROM groups ORDER BY position, id")?;
    let rows = st.query_map([], |r| {
        Ok(Group {
            id: r.get(0)?,
            name: r.get(1)?,
            position: r.get(2)?,
            collapsed: r.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn get_group(c: &Connection, id: i64) -> rusqlite::Result<Option<Group>> {
    c.query_row(
        "SELECT id,name,position,collapsed FROM groups WHERE id=?1",
        [id],
        |r| {
            Ok(Group {
                id: r.get(0)?,
                name: r.get(1)?,
                position: r.get(2)?,
                collapsed: r.get(3)?,
            })
        },
    )
    .optional()
}

pub fn insert_group(c: &Connection, name: &str) -> rusqlite::Result<i64> {
    let position = next_root_position(c)?;
    c.execute(
        "INSERT INTO groups (name,position) VALUES (?1,?2)",
        params![name, position],
    )?;
    Ok(c.last_insert_rowid())
}

pub fn rename_group(c: &Connection, id: i64, name: &str) -> rusqlite::Result<()> {
    c.execute("UPDATE groups SET name=?2 WHERE id=?1", params![id, name])?;
    Ok(())
}

pub fn set_group_collapsed(c: &Connection, id: i64, collapsed: bool) -> rusqlite::Result<()> {
    c.execute(
        "UPDATE groups SET collapsed=?2 WHERE id=?1",
        params![id, collapsed],
    )?;
    Ok(())
}

/// Löscht die Gruppe; ihre Overlays bleiben erhalten und rücken an ihre Stelle auf die oberste Ebene.
pub fn delete_group(c: &Connection, id: i64) -> rusqlite::Result<()> {
    let tx = c.unchecked_transaction()?;
    // (position, ist_gruppe, id) der obersten Ebene in aktueller Reihenfolge
    let mut root: Vec<(i64, bool, i64)> = Vec::new();
    {
        let mut st = tx.prepare("SELECT position,id FROM overlays WHERE group_id IS NULL")?;
        for row in st.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))? {
            let (p, oid) = row?;
            root.push((p, false, oid));
        }
        let mut st = tx.prepare("SELECT position,id FROM groups")?;
        for row in st.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))? {
            let (p, gid) = row?;
            root.push((p, true, gid));
        }
    }
    root.sort();
    let mut children: Vec<i64> = Vec::new();
    {
        let mut st =
            tx.prepare("SELECT id FROM overlays WHERE group_id=?1 ORDER BY position, id")?;
        for row in st.query_map([id], |r| r.get::<_, i64>(0))? {
            children.push(row?);
        }
    }
    let mut pos = 0i64;
    for (_, is_group, item_id) in root {
        if is_group && item_id == id {
            for child in &children {
                tx.execute(
                    "UPDATE overlays SET group_id=NULL, position=?2 WHERE id=?1",
                    params![child, pos],
                )?;
                pos += 1;
            }
        } else if is_group {
            tx.execute(
                "UPDATE groups SET position=?2 WHERE id=?1",
                params![item_id, pos],
            )?;
            pos += 1;
        } else {
            tx.execute(
                "UPDATE overlays SET position=?2 WHERE id=?1",
                params![item_id, pos],
            )?;
            pos += 1;
        }
    }
    tx.execute("DELETE FROM groups WHERE id=?1", [id])?;
    tx.commit()
}

/// Speichert die komplette Listenstruktur (Reihenfolge und Gruppenzugehörigkeit).
pub fn save_layout(c: &Connection, layout: &[LayoutItem]) -> rusqlite::Result<()> {
    let tx = c.unchecked_transaction()?;
    for (index, item) in layout.iter().enumerate() {
        let index = index as i64;
        match item {
            LayoutItem::Overlay { id } => {
                tx.execute(
                    "UPDATE overlays SET group_id=NULL, position=?2 WHERE id=?1",
                    params![id, index],
                )?;
            }
            LayoutItem::Group { id, children } => {
                tx.execute(
                    "UPDATE groups SET position=?2 WHERE id=?1",
                    params![id, index],
                )?;
                for (child_index, child) in children.iter().enumerate() {
                    tx.execute(
                        "UPDATE overlays SET group_id=?2, position=?3 WHERE id=?1",
                        params![child, id, child_index as i64],
                    )?;
                }
            }
        }
    }
    tx.commit()
}
