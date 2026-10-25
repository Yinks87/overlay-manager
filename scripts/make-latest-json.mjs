// Erzeugt nach `tauri build` die latest.json für den Updater im NSIS-Bundle-Ordner.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(
  readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const version = conf.version;
const endpoint = conf.plugins?.updater?.endpoints?.[0] ?? "";
const repo = endpoint.match(/github\.com\/([^/]+\/[^/]+)\/releases/)?.[1];
if (!repo)
  throw new Error(
    "GitHub-Repo konnte aus plugins.updater.endpoints nicht ermittelt werden.",
  );

const dir = join(root, "src-tauri", "target", "release", "bundle", "nsis");
const installer = existsSync(dir)
  ? readdirSync(dir).find((f) => f.endsWith(`_${version}_x64-setup.exe`))
  : undefined;
if (!installer)
  throw new Error(`Kein Installer für Version ${version} in ${dir} gefunden.`);

const sigPath = join(dir, `${installer}.sig`);
if (!existsSync(sigPath)) {
  throw new Error(
    `Signatur fehlt (${sigPath}). Ist TAURI_SIGNING_PRIVATE_KEY gesetzt?`,
  );
}

const latest = {
  version,
  notes: process.env.RELEASE_NOTES ?? "",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(sigPath, "utf8").trim(),
      // GitHub ersetzt Leerzeichen in Asset-Namen durch Punkte.
      url: `https://github.com/${repo}/releases/download/${version}/${installer.replace(/ /g, ".")}`,
    },
  },
};

const out = join(dir, "latest.json");
writeFileSync(out, JSON.stringify(latest, null, 2) + "\n");
console.log(`latest.json geschrieben: ${out}`);
