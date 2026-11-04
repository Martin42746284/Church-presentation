import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  session,
  type Display,
  type IpcMainInvokeEvent,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { BackendManager, type PhpBinary } from "./backend";
import {
  IPC,
  IPC_EVENTS,
  type AppPaths,
  type BackendStatus,
  type DisplayInfo,
  type ProjectionEvent,
  type ProjectionState,
} from "../shared/ipc";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  sanitizeSettings,
  type AppSettings,
  type SettingsPatch,
} from "../shared/settings";

const IS_PACKAGED = app.isPackaged;
const APP_ROOT = app.getAppPath();
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
const PRELOAD = path.join(APP_ROOT, "dist-electron", "preload.cjs");
const RENDERER_DEV_URL = process.env.VITE_DEV_SERVER_URL;

/**
 * User data never lives in the install directory (plan phase 1, §4):
 * Windows → %LOCALAPPDATA%\ChurchPresentation, elsewhere → XDG data dir.
 * Overridable with CHURCH_DATA_DIR for portable installs and tests.
 */
function resolveDataDir(): string {
  const fromEnv = process.env.CHURCH_DATA_DIR;
  if (fromEnv) return path.resolve(fromEnv);

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "ChurchPresentation");
  }

  const xdg = process.env.XDG_DATA_HOME ?? path.join(app.getPath("home"), ".local", "share");
  return path.join(xdg, "church-presentation");
}

const dataDir = resolveDataDir();
const backendDir = IS_PACKAGED
  ? path.join(process.resourcesPath, "backend")
  : path.join(REPO_ROOT, "backend");

const paths: AppPaths = {
  dataDir,
  databaseFile: path.join(dataDir, "data", "database.sqlite"),
  mediaDir: path.join(dataDir, "media"),
  backupDir: path.join(dataDir, "backups"),
  logDir: path.join(dataDir, "logs"),
  settingsDir: path.join(dataDir, "settings"),
  backendDir,
};

// Electron's own caches (GPU, cookies, …) follow the same root.
app.setPath("userData", path.join(dataDir, "shell"));

const php = resolvePhp();
const backend = new BackendManager({
  php,
  paths,
  ...(IS_PACKAGED ? { defaultMediaDir: path.join(process.resourcesPath, "default-media") } : {}),
  onStatus: (status) => broadcastBackend(status),
});

let adminWindow: BrowserWindow | null = null;
let projectionWindow: BrowserWindow | null = null;
let selectedDisplayId: number | null = readSelectedDisplayId();
let targetLost = false;
let lastProjectionState: ProjectionState = {
  slides: [],
  index: 0,
  blank: "none",
  lyricsVisible: true,
};

/**
 * Projection settings (theme, announcement, shortcuts): one object owned by
 * main, loaded from `<data>/settings/app.json` and broadcast to every window
 * so the console and the projector can never disagree.
 */
let appSettings: AppSettings = loadSettings();

function resolvePhp(): PhpBinary {
  if (process.env.CHURCH_PHP) return { command: process.env.CHURCH_PHP, preArgs: [] };

  if (IS_PACKAGED) {
    const bundled = path.join(process.resourcesPath, "php", "php.exe");
    if (process.platform === "win32" && fs.existsSync(bundled)) {
      return { command: bundled, preArgs: [] };
    }
    return { command: process.platform === "win32" ? "php.exe" : "php", preArgs: [] };
  }

  // Dev on Linux/macOS: the wrapper adds the extracted pdo_sqlite extension.
  const wrapper = path.join(REPO_ROOT, "tools", "php.sh");
  if (fs.existsSync(wrapper)) return { command: wrapper, preArgs: [] };

  return { command: "php", preArgs: [] };
}

/* ------------------------------------------------------------------ paths */

function settingsFile(): string {
  return path.join(paths.settingsDir, "display.json");
}

function readSelectedDisplayId(): number | null {
  try {
    const raw = fs.readFileSync(settingsFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "displayId" in parsed) {
      const id = (parsed as { displayId: unknown }).displayId;
      if (typeof id === "number") return id;
    }
  } catch {
    // First run or unreadable file: fall back to the primary display.
  }
  return null;
}

function persistSelectedDisplayId(id: number): void {
  try {
    fs.mkdirSync(paths.settingsDir, { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ displayId: id }, null, 2));
  } catch (error) {
    console.error("Impossible d'enregistrer l'écran cible :", error);
  }
}

/* --------------------------------------------------------------- settings */

function appSettingsFile(): string {
  return path.join(paths.settingsDir, "app.json");
}

/** Reads `<data>/settings/app.json`, defaulting field by field. */
function loadSettings(): AppSettings {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(appSettingsFile(), "utf8"));
    return sanitizeSettings(raw);
  } catch {
    // First run or unreadable file: the defaults are always usable.
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(): void {
  try {
    fs.mkdirSync(paths.settingsDir, { recursive: true });
    fs.writeFileSync(appSettingsFile(), JSON.stringify(appSettings, null, 2));
  } catch (error) {
    console.error("Impossible d'enregistrer les réglages :", error);
  }
}

/** Pushes the merged settings to every open window. */
function broadcastSettings(): void {
  for (const win of [adminWindow, projectionWindow]) {
    win?.webContents.send(IPC_EVENTS.settingsChanged, appSettings);
  }
}

/** Merges a patch, persists the result and tells every window about it. */
function applySettingsPatch(patch: unknown): AppSettings {
  appSettings = mergeSettings(appSettings, patch);
  persistSettings();
  broadcastSettings();
  return appSettings;
}

/* --------------------------------------------------------------- displays */

function targetDisplay(): Display {
  const all = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const selected = all.find((d) => d.id === selectedDisplayId);
  if (selected) return selected;
  if (selectedDisplayId === null) {
    return all.find((d) => d.id !== primary.id) ?? primary;
  }
  return primary;
}

function targetExists(): boolean {
  if (selectedDisplayId === null) return true;
  return screen.getAllDisplays().some((d) => d.id === selectedDisplayId);
}

function listDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `Écran ${d.id} — ${d.size.width}×${d.size.height}`,
    width: d.size.width,
    height: d.size.height,
    scaleFactor: d.scaleFactor,
    primary: d.id === primary.id,
    selected: d.id === targetDisplay().id,
  }));
}

function broadcastDisplays(): void {
  adminWindow?.webContents.send(IPC_EVENTS.displaysChanged, listDisplays());
}

function emitProjectionEvent(event: ProjectionEvent): void {
  adminWindow?.webContents.send(IPC_EVENTS.projectionEvent, event);
}

function broadcastBackend(status: BackendStatus): void {
  adminWindow?.webContents.send(IPC_EVENTS.backendEvent, status);
}

/* ------------------------------------------------------------- projection */

function createProjectionWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    skipTaskbar: true,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.on("closed", () => {
    if (projectionWindow === win) {
      projectionWindow = null;
      emitProjectionEvent({ type: "closed" });
    }
  });

  return win;
}

function placeProjectionOnTarget(): void {
  if (!projectionWindow || projectionWindow.isDestroyed()) return;
  const display = targetDisplay();
  projectionWindow.setBounds(display.bounds);
  if (!projectionWindow.isFullScreen()) projectionWindow.setFullScreen(true);
}

async function openProjection(): Promise<boolean> {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.focus();
    return true;
  }

  const win = createProjectionWindow();
  projectionWindow = win;

  try {
    await loadRenderer(win, "projection");
  } catch (error) {
    console.error("Fenêtre de projection : chargement impossible", error);
  }

  placeProjectionOnTarget();
  win.showInactive();
  win.webContents.send(IPC_EVENTS.projectionState, lastProjectionState);
  win.webContents.send(IPC_EVENTS.settingsChanged, appSettings);
  emitProjectionEvent({ type: "opened", displayId: targetDisplay().id });
  return true;
}

function closeProjection(): void {
  if (projectionWindow && !projectionWindow.isDestroyed()) projectionWindow.close();
}

/* ------------------------------------------------------------- app windows */

async function loadRenderer(win: BrowserWindow, view?: string): Promise<void> {
  if (RENDERER_DEV_URL) {
    const url = new URL(RENDERER_DEV_URL);
    if (view) url.searchParams.set("window", view);
    await win.loadURL(url.toString());
    return;
  }

  const file = path.join(APP_ROOT, "dist", "index.html");
  if (view) {
    await win.loadFile(file, { query: { window: view } });
  } else {
    await win.loadFile(file);
  }
}

async function createAdminWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    title: "Church Presentation — Console",
    backgroundColor: "#14110d",
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  adminWindow = win;
  win.on("closed", () => {
    if (adminWindow === win) adminWindow = null;
  });

  try {
    await loadRenderer(win);
  } catch (error) {
    console.error("Console : chargement impossible", error);
  }

  maybeCaptureScreenshot(win);
}

/**
 * Debug aid: `CHURCH_SCREENSHOT=/path.png npm start` dumps the console window
 * after `CHURCH_SCREENSHOT_DELAY` ms (default 6000). Used to verify rendering
 * in headless-ish environments and to produce documentation screenshots.
 */
function maybeCaptureScreenshot(win: BrowserWindow): void {
  const target = process.env.CHURCH_SCREENSHOT;
  if (!target) return;
  const delay = Number(process.env.CHURCH_SCREENSHOT_DELAY ?? 6000);
  setTimeout(() => {
    void win.webContents
      .capturePage()
      .then((image) => {
        fs.writeFileSync(target, image.toPNG());
        console.log(`[screenshot] ${target}`);
      })
      .catch((error) => console.error("[screenshot] échec", error));
  }, delay);
}

/* -------------------------------------------------------------------- IPC */

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * One handler per declared channel: the mapped type makes a missing (or
 * misnamed) channel a compile error, so the preload whitelist can never drift.
 */
const handlers: { [K in keyof typeof IPC]: IpcHandler } = {
  displaysList: () => listDisplays(),
  displaysSelect: (_event, id) => {
    if (typeof id !== "number") throw new Error("Identifiant d'écran invalide.");
    selectedDisplayId = id;
    targetLost = false;
    persistSelectedDisplayId(id);
    placeProjectionOnTarget();
    broadcastDisplays();
    return listDisplays();
  },
  displaysCurrent: () => (targetExists() ? targetDisplayToInfo() : null),

  projectionOpen: () => openProjection(),
  projectionClose: () => closeProjection(),
  projectionIsOpen: () => Boolean(projectionWindow && !projectionWindow.isDestroyed()),
  projectionSetState: (_event, state) => {
    if (!isProjectionState(state)) throw new Error("État de projection invalide.");
    lastProjectionState = state;
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.webContents.send(IPC_EVENTS.projectionState, state);
    }
    return true;
  },
  projectionGetState: () => lastProjectionState,
  projectionToggleFullscreen: () => {
    if (!projectionWindow || projectionWindow.isDestroyed()) return false;
    projectionWindow.setFullScreen(!projectionWindow.isFullScreen());
    return projectionWindow.isFullScreen();
  },

  backendStatus: () => backend.probe(),
  backendRestart: () => backend.restart(),
  appPaths: () => paths,

  settingsGet: () => appSettings,
  settingsSet: (_event, patch) => applySettingsPatch(patch),
};

/** Runtime guard: the bridge is the trust boundary, never assume the shape. */
function isProjectionState(value: unknown): value is ProjectionState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProjectionState>;
  return (
    Array.isArray(candidate.slides) &&
    typeof candidate.index === "number" &&
    typeof candidate.lyricsVisible === "boolean" &&
    (candidate.blank === "none" || candidate.blank === "black" || candidate.blank === "white")
  );
}

function targetDisplayToInfo(): DisplayInfo {
  const d = targetDisplay();
  const primary = screen.getPrimaryDisplay();
  return {
    id: d.id,
    label: d.label || `Écran ${d.id} — ${d.size.width}×${d.size.height}`,
    width: d.size.width,
    height: d.size.height,
    scaleFactor: d.scaleFactor,
    primary: d.id === primary.id,
    selected: d.id === targetDisplay().id,
  };
}

function registerIpc(): void {
  for (const key of Object.keys(handlers) as (keyof typeof IPC)[]) {
    ipcMain.handle(IPC[key], (event, ...args) => handlers[key](event, ...args));
  }
}

/* ------------------------------------------------------------ display hotplug */

function watchDisplays(): void {
  screen.on("display-added", () => {
    if (selectedDisplayId === null) placeProjectionOnTarget();
    if (targetLost && targetExists()) {
      targetLost = false;
      emitProjectionEvent({ type: "display-restored", displayId: selectedDisplayId ?? undefined });
    }
    broadcastDisplays();
  });

  screen.on("display-removed", (_event, display) => {
    if (display.id === selectedDisplayId) {
      targetLost = true;
      // Never leave the operator with an invisible window: park it on the
      // primary display, windowed, and tell the console about it.
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        projectionWindow.setFullScreen(false);
        projectionWindow.setBounds(screen.getPrimaryDisplay().bounds);
      }
      emitProjectionEvent({ type: "display-lost", displayId: display.id });
    } else if (selectedDisplayId === null) {
      placeProjectionOnTarget();
    }
    broadcastDisplays();
  });

  screen.on("display-metrics-changed", () => {
    if (!targetLost && targetExists()) placeProjectionOnTarget();
    broadcastDisplays();
  });
}

/* ------------------------------------------------------------------- lifecycle */

/**
 * Served pages get a strict Content-Security-Policy (no remote origin, no
 * eval). Dev is exempt: Vite injects an inline React Refresh preamble.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: file: http://127.0.0.1:*",
  "media-src 'self' file: http://127.0.0.1:*",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

function installContentSecurityPolicy(): void {
  if (RENDERER_DEV_URL) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP],
      },
    });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (adminWindow && !adminWindow.isDestroyed()) {
      if (adminWindow.isMinimized()) adminWindow.restore();
      adminWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    installContentSecurityPolicy();
    registerIpc();
    watchDisplays();
    await createAdminWindow();
    void backend.start();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createAdminWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    void backend.stop();
  });
}
