/**
 * Projection settings — the state Electron main owns (phase 7).
 *
 * The console and the workspace both push commands; main merges them into one
 * persisted settings object (`<data>/settings/app.json`) and broadcasts the
 * result to every window, so the projection always reflects the last command
 * whatever window issued it.
 *
 * Everything here is pure: `mergeSettings` is the single place that validates
 * values coming across the IPC bridge (the bridge is a trust boundary).
 */

export type ThemePreset = "nuit" | "bleu" | "noir" | "sepia" | "blanc";

export const THEME_PRESETS: readonly ThemePreset[] = [
  "nuit",
  "bleu",
  "noir",
  "sepia",
  "blanc",
] as const;

export type ThemeSettings = {
  /** Background preset of the projected slides. */
  preset: ThemePreset;
  /** Media file name used as background, `null` = preset background. */
  background: string | null;
  /** Text size multiplier (0.7 … 1.4), for readability on small/large screens. */
  fontScale: number;
  align: "center" | "left";
  /** Heavy text shadow, helps over a busy background image. */
  shadow: boolean;
};

export type AnnouncementSettings = {
  text: string;
  visible: boolean;
};

/** Single-key bindings, compared with `KeyboardEvent.key`. */
export type Shortcuts = {
  next: string;
  prev: string;
  black: string;
  white: string;
  restore: string;
  announce: string;
};

export type AppSettings = {
  theme: ThemeSettings;
  announcement: AnnouncementSettings;
  shortcuts: Shortcuts;
};

/** Partial update: every section and every field is optional. */
export type SettingsPatch = {
  theme?: Partial<ThemeSettings>;
  announcement?: Partial<AnnouncementSettings>;
  shortcuts?: Partial<Shortcuts>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: {
    preset: "nuit",
    background: null,
    fontScale: 1,
    align: "center",
    shadow: true,
  },
  announcement: { text: "", visible: false },
  shortcuts: {
    next: "ArrowRight",
    prev: "ArrowLeft",
    black: "b",
    white: "w",
    restore: "Escape",
    announce: "a",
  },
};

/** Media file names are `[A-Za-z0-9._-]` (see `MediaController`). */
const MEDIA_NAME = /^[A-Za-z0-9._-]+$/;
const MAX_SHORTCUT_LENGTH = 24;
const MAX_ANNOUNCEMENT_LENGTH = 600;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown, maxLength: number): string | null =>
  typeof value === "string" && value.length <= maxLength ? value : null;

function mergeTheme(current: ThemeSettings, patch: unknown): ThemeSettings {
  if (!isRecord(patch)) return current;

  const next: ThemeSettings = { ...current };

  if (typeof patch.preset === "string" && THEME_PRESETS.includes(patch.preset as ThemePreset)) {
    next.preset = patch.preset as ThemePreset;
  }

  if (patch.background === null) {
    next.background = null;
  } else if (typeof patch.background === "string" && MEDIA_NAME.test(patch.background)) {
    next.background = patch.background;
  }

  if (typeof patch.fontScale === "number" && Number.isFinite(patch.fontScale)) {
    next.fontScale = Math.round(clamp(patch.fontScale, 0.7, 1.4) * 100) / 100;
  }

  if (patch.align === "center" || patch.align === "left") {
    next.align = patch.align;
  }

  if (typeof patch.shadow === "boolean") {
    next.shadow = patch.shadow;
  }

  return next;
}

function mergeAnnouncement(current: AnnouncementSettings, patch: unknown): AnnouncementSettings {
  if (!isRecord(patch)) return current;

  const next: AnnouncementSettings = { ...current };

  // Truncated rather than dropped: pasting a long notice must not silently fail.
  if (typeof patch.text === "string")
    next.text = patch.text.trim().slice(0, MAX_ANNOUNCEMENT_LENGTH);
  if (typeof patch.visible === "boolean") next.visible = patch.visible;

  return next;
}

function mergeShortcuts(current: Shortcuts, patch: unknown): Shortcuts {
  if (!isRecord(patch)) return current;

  const next: Shortcuts = { ...current };

  for (const key of Object.keys(next) as (keyof Shortcuts)[]) {
    const value = patch[key];
    const cleaned = stringValue(value, MAX_SHORTCUT_LENGTH);

    if (cleaned !== null && cleaned !== "") next[key] = cleaned;
  }

  return next;
}

/**
 * Apply a patch (or a file read from disk) on top of `current`, silently
 * dropping anything malformed: a corrupted settings file or a hostile payload
 * can never take the projection out of a usable state.
 */
export function mergeSettings(current: AppSettings, patch: unknown): AppSettings {
  if (!isRecord(patch)) return current;

  return {
    theme: mergeTheme(current.theme, patch.theme),
    announcement: mergeAnnouncement(current.announcement, patch.announcement),
    shortcuts: mergeShortcuts(current.shortcuts, patch.shortcuts),
  };
}

/** A settings file read from disk, defaulted field by field. */
export function sanitizeSettings(raw: unknown): AppSettings {
  return mergeSettings(DEFAULT_SETTINGS, raw);
}
