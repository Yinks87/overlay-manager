# Overlay Manager

Windows-Desktop-App (Tauri v2 · Rust · React · SQLite), die beliebige Webseiten als **rahmenlose, transparente und durchklickbare Fenster** über dem Desktop anzeigt – zum Beispiel Stream-Widgets, Alerts, Chat-Overlays oder Dashboards, die du neben Spielen oder anderen Programmen im Blick behalten willst.

## Was macht die App?

Jedes **Overlay** ist eine URL, die in einem eigenen Fenster ohne Rahmen und Titelleiste geöffnet wird. Das Fenster liegt immer im Vordergrund, erscheint nicht in der Taskleiste und lässt Mausklicks hindurch, sodass du darunter normal weiterarbeiten kannst. Verwaltet werden alle Overlays im **Dashboard** (Hauptfenster).

### Seitenaufbau des Dashboards

Ein Hauptmenü links bietet drei Seiten:

- **Dashboard** (Startseite): alle angeschlossenen Monitore in ihrer tatsächlichen Anordnung mit den Positionen der Overlays, dazu Kennzahlen und „Alle öffnen / Alle schließen“. Ein Klick auf ein Overlay öffnet seine Einstellungen.
- **Overlays**: das gesamte Overlay-Handling – Liste mit Gruppen und Drag & Drop links, Einstellungen des gewählten Overlays rechts.
- **Einstellungen**: App-Einstellungen (Schließverhalten, Updates).

### Overlays

- **Beliebig viele Overlays** mit Name, URL, Position und Größe (physische Bildschirmpixel, auch auf mehreren Monitoren).
- **Bearbeitungsmodus**: Ein Overlay lässt sich direkt auf dem Bildschirm verschieben (Balken oben) und skalieren (Ecken/Kanten). Position und Größe werden automatisch gespeichert. Im Normalbetrieb ist das Overlay gesperrt und durchklickbar.
- **Zoom statt Abschneiden**: Wird ein Overlay-Fenster verkleinert oder vergrößert, skaliert die Seite mit, sodass sie immer komplett sichtbar ist (WebView-Zoom, 25–500 %). 100 % gilt bei der Referenzgröße des Overlays; sie lässt sich im Editor mit „Aktuelle Größe = 100 %“ neu festlegen.
- **Mindestgröße**: Overlay-Fenster lassen sich nicht kleiner als 200 × 200 Pixel machen.
- **Maximieren**: Das Overlay füllt den Monitor, auf dem es liegt (dabei wird es automatisch gesperrt). Der Zustand wird pro Overlay gespeichert; beim nächsten Öffnen startet es wieder maximiert oder in der eingestellten Größe.
- **Audio**: Lautstärke und Stummschaltung pro Overlay, optional mit Stumm-Symbol im Overlay.
- **Darstellung**: Transparenter Seitenhintergrund (optional) und farbiger Rahmen mit frei wählbarer Farbe, der die Position auf dem Bildschirm markiert.
- **Live-Übernahme**: Beim Speichern wird ein geöffnetes Overlay sofort aktualisiert und neu geladen.
- **Aktiviert/Deaktiviert**: Ein Overlay, das beim Beenden der App geöffnet war, startet beim nächsten App-Start automatisch wieder. Geschlossene Overlays bleiben geschlossen.
- **Bildschirmübersicht**: Eine Miniatur zeigt **alle angeschlossenen Monitore** in ihrer tatsächlichen Anordnung (Position im virtuellen Desktop), markiert Hauptmonitor und den Monitor, auf dem das Dashboard liegt, und zeigt alle Overlays maßstabsgetreu darauf. Overlays außerhalb aller Monitore werden aufgelistet.
- **Gruppen**: Overlays lassen sich in Gruppen ordnen (Button „Neue Gruppe“, Doppelklick oder ✎ zum Umbenennen, ✕ löscht nur die Gruppe, die Overlays bleiben erhalten). Gruppen sind auf- und zuklappbar; jede Gruppe hat einen eigenen Button zum Öffnen/Schließen aller ihrer Overlays.
- **Drag & Drop**: Overlays und Gruppen lassen sich per Ziehen in der Liste umsortieren; Overlays können zwischen Gruppen und der obersten Ebene verschoben werden. Die Reihenfolge wird gespeichert.
- **Kontextmenü**: Rechtsklick auf eine Overlay-Karte öffnet Schnellaktionen: Öffnen/Schließen, Maximieren, Einstellungen bearbeiten, Bearbeitungsmodus, Stummschalten, Lautstärkeregler, Kopieren (Duplizieren) und URL in die Zwischenablage. Bedienung auch per Tastatur (Pfeiltasten, Esc).
- **Alle öffnen / Alle schließen**: aktiviert bzw. deaktiviert alle Overlays auf einmal (das Aktiviert-Merkmal bestimmt, was beim nächsten App-Start geöffnet wird).

### Dashboard und App-Einstellungen

- Position und Größe des Dashboards werden gespeichert und beim Start wiederhergestellt.
- **Schließverhalten** (Einstellungen → „Beim Schließen des Dashboards“):
  - *App beenden*: schließt Dashboard und alle Overlays.
  - *In den Tray minimieren*: Das Dashboard verschwindet aus der Taskleiste und läuft als Symbol im Infobereich weiter, die Overlays bleiben aktiv. Linksklick auf das Symbol öffnet das Dashboard, Rechtsklick zeigt das Menü („Dashboard öffnen“, „Beenden“).
- **Nur eine Instanz**: Ein zweiter Start öffnet kein zweites Fenster, sondern holt das vorhandene Dashboard nach vorn.
- **Updates**: Einstellungen → „Nach Updates suchen“ lädt neue Versionen aus den GitHub Releases, installiert sie und startet die App neu. Optional (beide standardmäßig aus):
  - *Beim Start der App nach Updates suchen*: zeigt im Dashboard einen Hinweis, wenn eine neuere Version verfügbar ist.
  - *Updates automatisch installieren*: installiert gefundene Updates beim Start ohne Rückfrage und startet die App neu (setzt die automatische Suche voraus).

Alle Daten (Overlays, Einstellungen) liegen in einer lokalen SQLite-Datei unter `%APPDATA%\com.example.overlaymanager\overlays.db`.

## 1. Voraussetzungen (Windows 10/11)

- [Node.js LTS](https://nodejs.org)
- [Rust](https://rustup.rs) (`rustup default stable-msvc`)
- Visual Studio Build Tools mit „Desktop development with C++“
- WebView2 Runtime (in Windows 11 bereits enthalten)

## 2. Projekt aufsetzen

```powershell
git clone https://github.com/Yinks87/overlay-manager.git
cd overlay-manager
npm install
npm run tauri icon app-icon.png     # erzeugt src-tauri/icons/* (eigenes Logo ≥ 1024 px möglich)
npm run tauri dev
```

## 3. Starten und bauen

```powershell
npm run tauri dev       # Entwicklung (Hot Reload für das Frontend)
npm run tauri build     # Installer unter src-tauri/target/release/bundle/nsis/
```

## 4. Updates über GitHub Releases

Die App prüft über `plugins.updater.endpoints` in `src-tauri/tauri.conf.json` die Datei
`https://github.com/yinks87/overlay-manager/releases/latest/download/latest.json`. Updates sind mit einem Schlüsselpaar signiert; der öffentliche Schlüssel steht in `tauri.conf.json`.

**Einmalig**

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\overlay-manager.key"
```

Den öffentlichen Schlüssel (`.key.pub`) in `plugins.updater.pubkey` eintragen. Den privaten Schlüssel sicher aufbewahren und **nie** einchecken: Ohne ihn lassen sich keine Updates mehr signieren.

**Release lokal bauen**

1. Version in `package.json`, `src-tauri/Cargo.toml` und `src-tauri/tauri.conf.json` erhöhen.
2. Bauen (Passwort-Prompt bei einem Schlüssel ohne Passwort mit Enter bestätigen):

   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\overlay-manager.key"
   npm run release
   ```

   `npm run release` führt `tauri build` aus und erzeugt danach mit `scripts/make-latest-json.mjs` die `latest.json` im selben Ordner (optionale Release-Notes über `$env:RELEASE_NOTES`).
3. Auf GitHub ein Release mit dem Tag `<version>` (ohne „v“, z. B. `0.2.0`) anlegen, denn die URL in der `latest.json` verweist darauf. Dann diese drei Dateien aus `src-tauri/target/release/bundle/nsis/` hochladen:
   - `Overlay Manager_<version>_x64-setup.exe`
   - `Overlay Manager_<version>_x64-setup.exe.sig`
   - `latest.json`

   Alle drei müssen aus **demselben** Build stammen, denn die Signatur gilt nur für genau diese `.exe`. Das Release darf kein Draft und kein Pre-release sein.

**Release per GitHub Actions**

Der Workflow `.github/workflows/release.yml` baut, signiert und veröffentlicht automatisch, sobald ein Tag gepusht wird, der mit einer Ziffer beginnt (z. B. `git tag 0.2.0; git push origin 0.2.0`). Dafür muss im Repository das Secret `TAURI_SIGNING_PRIVATE_KEY` (Inhalt der privaten Schlüsseldatei) angelegt sein.

Der Windows-Installer ist nicht code-signiert, SmartScreen kann deshalb beim ersten Start warnen.

## 5. Projektstruktur

```
overlay-manager/
├─ package.json · vite.config.js · index.html
├─ scripts/make-latest-json.mjs  ← erzeugt latest.json für den Updater
├─ .github/workflows/release.yml ← Release-Build per GitHub Actions
├─ src/                          ← React (JSX)
│  ├─ main.jsx · App.jsx · App.css   ← App.jsx: Hauptmenü und Seitenwechsel
│  ├─ api.js                     ← invoke()-Wrapper für die Rust-Commands
│  ├─ hooks/useOverlays.js       ← Zustand, Events, optimistische Updates
│  ├─ hooks/useMonitors.js       ← angeschlossene Monitore (Position, Größe, Haupt-/Dashboard-Monitor)
│  ├─ layout.js                  ← Listenstruktur: Gruppen, Sortierung, Drag-&-Drop-Logik
│  └─ components/
│     ├─ OverlayList.jsx         ← Liste mit Gruppen, Drag & Drop, Öffnen/Schließen/Maximieren
│     ├─ OverlayEditor.jsx       ← Einstellungen je Overlay
│     ├─ ScreenMap.jsx           ← Miniatur aller Monitore mit allen Overlays
│     ├─ DashboardPage.jsx       ← Startseite: Monitore + Overlay-Positionen
│     ├─ OverlaysPage.jsx        ← Overlay-Seite: Liste + Editor
│     └─ SettingsPage.jsx        ← App-Einstellungen (Schließverhalten, Updates)
└─ src-tauri/
   ├─ tauri.conf.json · Cargo.toml · build.rs
   ├─ capabilities/              ← IPC-Rechte (default.json: Dashboard, overlays.json: Overlay-Fenster)
   └─ src/
      ├─ main.rs · lib.rs        ← Setup, Single-Instance, Tray, Window-Events
      ├─ db.rs                   ← SQLite (rusqlite): Schema, Migrationen, CRUD, App-Einstellungen
      ├─ overlay.rs              ← Multi-Window, Click-Through, Lock, Maximieren, Geometrie
      ├─ commands.rs             ← Tauri-Commands für das Frontend
      └─ inject.js               ← Audio-Regler, Transparenz, Rahmen, Bedienelemente (in die Seite injiziert)
```

## 6. So funktioniert es

| Anforderung | Umsetzung |
|---|---|
| Eigenes Fenster pro Overlay | `WebviewWindowBuilder` mit `WebviewUrl::External(url)`, Label `overlay-<id>` (`overlay.rs::open`) |
| Rahmenlos + transparent | `.decorations(false).transparent(true).shadow(false).always_on_top(true).skip_taskbar(true)` – **nie** nativer Rahmen, Titelleiste oder Schließen-Button |
| Click-Through | `window.set_ignore_cursor_events(true)` im gesperrten Zustand (`overlay.rs::apply_mode`) |
| Bearbeitungsmodus | **Aus (gesperrt)** = durchklickbar. **An** = Seite blendet per `inject.js` einen Verschiebe-Balken sowie Anfasser an Kanten/Ecken ein (Drag/Resize über `core:window:allow-start-dragging` / `-resize-dragging`, nur für `overlay-*`, siehe `capabilities/overlays.json`). Position/Größe werden dabei automatisch in SQLite gespeichert |
| Maximieren | Overlay füllt den aktuellen Monitor; gespeicherte Position/Größe bleiben unverändert. Spalte `maximized` merkt sich den Zustand für den nächsten Start |
| Lautstärke / Mute | `inject.js` skaliert `<audio>`/`<video>` und die Web Audio API (Master-Gain) und wird live per `eval` gesteuert |
| Aktiviert-Status | Spalte `enabled`: wird beim Öffnen/Schließen gesetzt; `lib.rs::setup` öffnet beim App-Start alle aktivierten Overlays |
| Dashboard-Geometrie | Position/Größe des Hauptfensters in `app_settings` (`position_x/y`, `size_width/height`), Wiederherstellung beim Start (nur, wenn die Position auf einem vorhandenen Monitor liegt) |
| Schließverhalten | `app_settings.close_behavior` (`exit` oder `minimize`); bei `minimize` wird das Fenster versteckt und ein Tray-Symbol eingeblendet |
| Einzelinstanz | `tauri-plugin-single-instance` |
| Persistenz | SQLite; das Frontend spricht nur über Tauri-Commands mit der DB. Ältere Datenbanken werden beim Start automatisch migriert |
| Sicherheit | Overlay-Fenster laden externe Seiten und dürfen nur ihr eigenes Fenster ziehen/skalieren, sie haben keinen Zugriff auf weitere Tauri-IPC. Lade nur Seiten, denen du vertraust |

## 7. Bekannte Grenzen

- **Vollbild-Spiele**: Overlays erscheinen nur über Fenster-/Rahmenlos-Vollbild, nicht über exklusivem Vollbild.
- **Audio**: Die Lautstärkeregelung ist eine Best-Effort-Injektion (HTML-Media + Web Audio). Seiten mit eigenem Audio-Backend (z. B. reine WASM-Ausgabe) werden nicht erfasst.
- **Transparenz**: Der Seitenhintergrund wird per CSS transparent gesetzt. Seiten, die ihren Hintergrund auf einem inneren Element zeichnen, bleiben dort deckend.
- **Mehrere Monitore / DPI**: Die Koordinaten der Overlays gelten im gemeinsamen virtuellen Desktop in physischen Pixeln (negative Werte = Monitor links/oberhalb des Hauptmonitors).
- **Deadlock-Regel**: Beim Erweitern des Rust-Codes den DB-Lock nie während Fenster-Aufrufen halten.

