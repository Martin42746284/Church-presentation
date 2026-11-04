import type { ChurchApi } from "@shared/ipc";

/**
 * Typed access to the preload bridge. In a plain browser (development without
 * Electron) `window.church` is undefined and the UI degrades gracefully.
 */
export const church: ChurchApi | undefined =
  typeof window === "undefined" ? undefined : window.church;

export const isDesktop = church !== undefined;

/** Small helper so callers can await a bridge call without `church?` noise. */
export function requireChurch(): ChurchApi {
  if (!church) throw new Error("API Electron indisponible (exécution en navigateur).");
  return church;
}
