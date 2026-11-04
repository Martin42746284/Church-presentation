import { contextBridge, ipcRenderer } from "electron";
import { IPC, IPC_EVENTS, type ChurchApi } from "../shared/ipc";
import type { SettingsPatch } from "../shared/settings";

function subscribe<T>(channel: string): (cb: (payload: T) => void) => () => void {
  return (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * The only object the renderer can reach. Every channel is declared in
 * shared/ipc.ts — nothing else is exposed to the page.
 */
const api: ChurchApi = {
  listDisplays: () => ipcRenderer.invoke(IPC.displaysList),
  selectDisplay: (id) => ipcRenderer.invoke(IPC.displaysSelect, id),
  currentDisplay: () => ipcRenderer.invoke(IPC.displaysCurrent),

  openProjection: () => ipcRenderer.invoke(IPC.projectionOpen),
  closeProjection: () => ipcRenderer.invoke(IPC.projectionClose),
  isProjectionOpen: () => ipcRenderer.invoke(IPC.projectionIsOpen),
  setProjectionState: (state) => ipcRenderer.invoke(IPC.projectionSetState, state),
  getProjectionState: () => ipcRenderer.invoke(IPC.projectionGetState),
  toggleFullscreen: () => ipcRenderer.invoke(IPC.projectionToggleFullscreen),

  backendStatus: () => ipcRenderer.invoke(IPC.backendStatus),
  restartBackend: () => ipcRenderer.invoke(IPC.backendRestart),
  getPaths: () => ipcRenderer.invoke(IPC.appPaths),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: SettingsPatch) => ipcRenderer.invoke(IPC.settingsSet, patch),

  onDisplaysChanged: subscribe(IPC_EVENTS.displaysChanged),
  onProjectionEvent: subscribe(IPC_EVENTS.projectionEvent),
  onProjectionState: subscribe(IPC_EVENTS.projectionState),
  onBackendEvent: subscribe(IPC_EVENTS.backendEvent),
  onSettings: subscribe(IPC_EVENTS.settingsChanged),
};

contextBridge.exposeInMainWorld("church", api);
