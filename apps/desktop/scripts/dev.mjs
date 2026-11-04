/**
 * Development runner: Vite dev server + Electron, with hot rebuild of the
 * main/preload bundles whenever electron/ or shared/ changes.
 *
 *   node scripts/dev.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleElectron } from "./build-electron.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_URL = "http://127.0.0.1:5173";

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const electronBin = path.join(root, "node_modules", "electron", "cli.js");

let vite = null;
let electron = null;
let electronStarting = false;
let restartRequested = false;

function log(message) {
  console.log(`[dev] ${message}`);
}

async function waitForDevServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok || response.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Le serveur de dev n'a pas répondu sur ${url}`);
}

function startVite() {
  vite = spawn(process.execPath, [viteBin, "--port", "5173", "--strictPort"], {
    cwd: root,
    stdio: "inherit",
  });
  vite.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[dev] Vite s'est arrêté (code ${code}).`);
      shutdown(1);
    }
  });
}

async function startElectron() {
  if (electronStarting) return;
  electronStarting = true;
  try {
    await bundleElectron();
  } catch (error) {
    console.error("[dev] Échec du bundling Electron :", error);
    electronStarting = false;
    return;
  }

  electron = spawn(process.execPath, [electronBin, "."], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL },
  });
  electronStarting = false;

  electron.on("exit", (code) => {
    electron = null;
    if (restartRequested) {
      restartRequested = false;
      void startElectron();
      return;
    }
    shutdown(code ?? 0);
  });
}

function restartElectron() {
  if (!electron) {
    void startElectron();
    return;
  }
  restartRequested = true;
  electron.kill();
}

function watchSources() {
  const watched = [path.join(root, "electron"), path.join(root, "shared")];
  let timer = null;

  for (const dir of watched) {
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (filename && !/\.(ts|tsx|json)$/.test(filename)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        log(`Rebuild Electron (${filename ?? "source"})`);
        restartElectron();
      }, 200);
    });
  }
}

function shutdown(code = 0) {
  if (electron && !electron.killed) electron.kill();
  if (vite && !vite.killed) vite.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startVite();
await waitForDevServer(DEV_URL);
log(`Serveur de dev prêt sur ${DEV_URL}`);
watchSources();
await startElectron();
log("Electron lancé. Ctrl+C pour quitter.");
