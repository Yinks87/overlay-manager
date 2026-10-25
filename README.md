# Overlay Manager (Tauri v2 · Rust · React/JSX · SQLite)

Windows-Desktop-App, die Web-URLs als **eigene, rahmenlose, transparente und durchklickbare Fenster** über dem Desktop anzeigt.

## 1. Voraussetzungen (Windows 10/11)

- [Node.js LTS](https://nodejs.org)
- [Rust](https://rustup.rs) (`rustup default stable-msvc`)
- Visual Studio Build Tools mit „Desktop development with C++“
- WebView2 Runtime (in Windows 11 bereits enthalten)

## 2. Projekt aufsetzen

### Variante A – dieses Archiv verwenden

```powershell
cd overlay-manager
npm install
npm run tauri icon app-icon.png     # erzeugt src-tauri/icons/* (eigenes Logo ≥ 1024 px möglich)
npm run tauri dev
```

### Variante B – frisch mit create-tauri-app starten

```powershell
npm create tauri-app@latest overlay-manager
#  Identifier:       com.example.overlaymanager
#  Frontend language: JavaScript
#  Package manager:   npm
#  UI template:       React
#  UI flavor:         JavaScript
cd overlay-manager
npm install
```

Danach die Dateien aus diesem Archiv über das Projekt kopieren (`src/`, `src-tauri/src/`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `vite.config.js`, `index.html`) und die
Template-Dateien `src/App.jsx`, `src/App.css`, `src-tauri/src/lib.rs` überschreiben. Die bereits generierten Icons bleiben erhalten.

## 3. Starten und bauen

```powershell
npm run tauri dev       # Entwicklung (Hot Reload für das Frontend)
npm run tauri build     # Installer unter src-tauri/target/release/bundle/nsis/
```

Die SQLite-Datei liegt unter `%APPDATA%\com.example.overlaymanager\overlays.db`.

## 4. Projektstruktur

```
overlay-manager/
├─ package.json · vite.config.js · index.html
├─ src/                          ← React (JSX)
│  ├─ main.jsx · App.jsx · App.css
│  ├─ api.js                     ← invoke()-Wrapper für die Rust-Commands
│  ├─ hooks/useOverlays.js       ← Zustand, Events, optimistische Updates
│  └─ components/
│     ├─ OverlayList.jsx         ← Liste + Öffnen/Schließen
│     ├─ OverlayEditor.jsx       ← Einstellungs-Dashboard je Overlay
│     └─ ScreenMap.jsx           ← Miniatur des Bildschirms mit allen Overlays
└─ src-tauri/
   ├─ tauri.conf.json · Cargo.toml · build.rs
   ├─ capabilities/default.json  ← IPC-Rechte nur für das Hauptfenster
   └─ src/
      ├─ main.rs · lib.rs        ← Setup, DB-Init, Autostart, Window-Events
      ├─ db.rs                   ← SQLite (rusqlite), Schema + CRUD
      ├─ overlay.rs              ← Multi-Window, Click-Through, Lock, Geometrie
      ├─ commands.rs             ← Tauri-Commands für das Frontend
      └─ inject.js               ← Audio-Regler + transparenter Hintergrund (in die Seite injiziert)
```

## 5. So funktioniert es

| Anforderung | Umsetzung |
|---|---|
| Eigenes Fenster pro Overlay | `WebviewWindowBuilder` mit `WebviewUrl::External(url)`, Label `overlay-<id>` (`overlay.rs::open`) |
| Rahmenlos + transparent | `.decorations(false).transparent(true).shadow(false).always_on_top(true).skip_taskbar(true)` – **nie** nativer Rahmen, Titelleiste oder Schließen-Button |
| Click-Through | `window.set_ignore_cursor_events(true)` im gesperrten Zustand (`overlay.rs::apply_lock`) |
| Bearbeitungsmodus | **Aus (gesperrt)** = durchklickbar. **An** = Seite blendet per `inject.js` einen farbigen Verschiebe-Balken sowie Anfasser an Kanten/Ecken ein (Drag/Resize über `core:window:allow-start-dragging` / `-resize-dragging`, nur für `overlay-*`, siehe `capabilities/overlays.json`). Position/Größe werden dabei automatisch in SQLite gespeichert |
| Größe & Position | Physische Bildschirmpixel; per Zahlenfeld oder durch Ziehen im Bearbeitungsmodus |
| Lautstärke / Mute | `inject.js` skaliert `<audio>`/`<video>` und die Web Audio API (Master-Gain) und wird live per `eval` gesteuert |
| Autostart | Spalte `autostart`; `lib.rs::setup` öffnet beim App-Start alle markierten Overlays |
| Persistenz | `overlays`-Tabelle in SQLite, Frontend spricht nur über Tauri-Commands mit der DB |
| Sicherheit | Overlay-Fenster laden externe Seiten und haben **keine** Capability, also keinen Zugriff auf Tauri-IPC |

## 6. Bekannte Grenzen

- **Vollbild-Spiele**: Overlays erscheinen nur über Fenster-/Rahmenlos-Vollbild, nicht über exklusivem Vollbild.
- **Audio**: Die Lautstärkeregelung ist eine Best-Effort-Injektion (HTML-Media + Web Audio). Seiten mit eigenem Audio-Backend (z. B. reine WASM-Ausgabe) werden nicht erfasst.
- **Transparenz**: Der Seitenhintergrund wird per CSS transparent gesetzt. Seiten, die ihren Hintergrund auf einem inneren Element zeichnen, bleiben dort deckend.
- **Mehrere Monitore / DPI**: Die Bildschirmübersicht zeigt den Hauptmonitor; die Koordinaten gelten im gemeinsamen virtuellen Desktop (negative Werte = Monitor links/oberhalb des Hauptmonitors).
- **Deadlock-Regel**: Beim Erweitern des Rust-Codes den DB-Lock nie während Fenster-Aufrufen halten.

## 7. Neu in Version 2

- **Maximieren** pro Overlay (Liste und Dashboard): füllt den Monitor, auf dem das Overlay liegt. Dabei wird das Overlay automatisch gesperrt (durchklickbar), damit es das Dashboard nicht verdeckt. Gespeicherte Position/Größe bleiben erhalten.
- **Speichern lädt neu**: Beim Speichern wird ein offenes Overlay sofort neu geladen (bei geänderter URL: neue Adresse).
- **Farbiger Rahmen** (optional, Farbwahl): wird in die Seite gezeichnet, ist nicht anklickbar und zeigt die Position.
- **Sicherheit**: Overlay-Seiten dürfen über `capabilities/overlays.json` nur ihr eigenes Fenster ziehen/skalieren. Lade nur Seiten, denen du vertraust.
- Bestehende Datenbanken werden automatisch um die Rahmen-Spalten erweitert.

## 8. Neu in Version 3

- **Dezentere Anfasser**: Ecken als schmale Winkel, Kanten mit einer kleinen Markierung, die nur beim Überfahren erscheint.
- **Stumm-Symbol** (optional): kleines Lautsprecher-Symbol oben rechts im Overlay, solange es stummgeschaltet ist.
- **Position**: Die Webview-Fläche wird exakt auf X/Y ausgerichtet, auch wenn Windows einen unsichtbaren Fensterrand meldet.
- **Seitenhintergrund transparent**: injiziert `html, body { background: transparent !important }`. Das Fenster selbst ist immer transparent; dieser Schalter entfernt zusätzlich den deckenden Hintergrund der Seite, damit der Desktop dahinter durchscheint. Hintergründe einzelner Elemente (Karten, Container) bleiben bestehen.

