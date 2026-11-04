/**
 * IPC contract between the renderer, the preload bridge and Electron main.
 *
 * This file is the single source of truth for the desktop app: the preload
 * exposes exactly these channels, main registers a handler for every invoke
 * channel (the `Record<keyof typeof IPC, …>` type makes a missing handler a
 * compile error) and the renderer never talks to Node directly.
 */
import type { Slide } from "../../../src/lib/slides";
import type { AppSettings, SettingsPatch } from "./settings";

export type Blank = "none" | "black" | "white";

/** Channels the renderer may invoke (request/response). */
export const IPC = {
  displaysList: "displays:list",
  displaysSelect: "displays:select",
  displaysCurrent: "displays:current",
  projectionOpen: "projection:open",
  projectionClose: "projection:close",
  projectionIsOpen: "projection:is-open",
  projectionSetState: "projection:set-state",
  projectionGetState: "projection:get-state",
  projectionToggleFullscreen: "projection:toggle-fullscreen",
  backendStatus: "backend:status",
  backendRestart: "backend:restart",
  appPaths: "app:paths",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
} as const;

export type IpcInvokeChannel = keyof typeof IPC;

/** Channels main may push to a window (events). */
export const IPC_EVENTS = {
  displaysChanged: "event:displays-changed",
  projectionEvent: "event:projection",
  projectionState: "event:projection-state",
  backendEvent: "event:backend",
  settingsChanged: "event:settings",
} as const;

export type IpcEventChannel = keyof typeof IPC_EVENTS;

export const IPC_INVOKE_CHANNELS: readonly string[] = Object.values(IPC);
export const IPC_EVENT_CHANNELS: readonly string[] = Object.values(IPC_EVENTS);

export type DisplayInfo = {
  id: number;
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
  selected: boolean;
};

export type ProjectionState = {
  slides: Slide[];
  index: number;
  blank: Blank;
  lyricsVisible: boolean;
};

export type BackendState = "stopped" | "starting" | "running" | "error";

export type BackendStatus = {
  state: BackendState;
  url: string | null;
  healthy: boolean;
  version: string | null;
  php: string | null;
  migrations: number | null;
  database: string | null;
  error: string | null;
};

export type AppPaths = {
  dataDir: string;
  databaseFile: string;
  mediaDir: string;
  backupDir: string;
  logDir: string;
  settingsDir: string;
  backendDir: string;
};

export type ProjectionEventType =
  "opened" | "closed" | "display-lost" | "display-restored" | "fullscreen";

export type ProjectionEvent = {
  type: ProjectionEventType;
  // `| undefined` keeps `exactOptionalPropertyTypes` happy when the id is unknown.
  displayId?: number | undefined;
};

/**
 * API exposed on `window.church` by the preload script. The renderer only ever
 * calls this — never `ipcRenderer` directly.
 */
export type ChurchApi = {
  listDisplays(): Promise<DisplayInfo[]>;
  selectDisplay(id: number): Promise<DisplayInfo[]>;
  currentDisplay(): Promise<DisplayInfo | null>;

  openProjection(): Promise<boolean>;
  closeProjection(): Promise<void>;
  isProjectionOpen(): Promise<boolean>;
  setProjectionState(state: ProjectionState): Promise<void>;
  getProjectionState(): Promise<ProjectionState>;
  toggleFullscreen(): Promise<boolean>;

  backendStatus(): Promise<BackendStatus>;
  restartBackend(): Promise<BackendStatus>;
  getPaths(): Promise<AppPaths>;

  /** Settings live in main: read the merged object, patch it, get told when it changes. */
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: SettingsPatch): Promise<AppSettings>;

  onDisplaysChanged(cb: (displays: DisplayInfo[]) => void): () => void;
  onProjectionEvent(cb: (event: ProjectionEvent) => void): () => void;
  onProjectionState(cb: (state: ProjectionState) => void): () => void;
  onBackendEvent(cb: (status: BackendStatus) => void): () => void;
  onSettings(cb: (settings: AppSettings) => void): () => void;
};

declare global {
  interface Window {
    church?: ChurchApi;
  }
}
