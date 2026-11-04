import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings,
  type SettingsPatch,
} from "@shared/settings";
import { church } from "@app/church-api";

/**
 * Renderer side of the projection settings (phase 7).
 *
 * Electron main owns the persisted object; this store mirrors it so every
 * component (console, workspace, preview, projection window) reads the same
 * values. In a plain browser there is no bridge: the settings stay local to
 * the tab, which is the documented degradation of the web mode.
 */
let current: AppSettings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();
let started = false;

function publish(next: AppSettings): void {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSettings(): AppSettings {
  return current;
}

/** Loads the settings held by main and follows every broadcast from it. */
export function startSettingsSync(): void {
  if (started || !church) return;
  started = true;
  church.onSettings(publish);
  void church
    .getSettings()
    .then(publish)
    .catch(() => undefined);
}

/**
 * Applies a patch: instantly in this window (sliders must feel immediate),
 * then replaced by the merged object main broadcasts back.
 */
export function updateSettings(patch: SettingsPatch): void {
  publish(mergeSettings(current, patch));
  void church
    ?.updateSettings(patch)
    .then(publish)
    .catch(() => undefined);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
