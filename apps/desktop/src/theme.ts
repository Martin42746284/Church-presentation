import type { CSSProperties } from "react";
import type { AppSettings, ThemePreset } from "@shared/settings";
import { mediaUrl } from "@app/api";

/** Inline style carrying the `--slide-*` variables the stage reads. */
export type SlideTheme = CSSProperties & Record<`--${string}`, string | number>;

export const THEME_LABELS: Record<ThemePreset, string> = {
  nuit: "Nuit",
  bleu: "Bleu",
  noir: "Noir",
  sepia: "Sépia",
  blanc: "Blanc",
};

/**
 * Preset backgrounds. They only paint through `--slide-bg` / `--slide-fg`,
 * so the shared `SlideView` of the web app keeps working untouched (D6).
 */
const PRESETS: Record<ThemePreset, { background: string; foreground: string }> = {
  nuit: {
    background: "radial-gradient(ellipse at 50% 30%, oklch(0.3 0.06 260), oklch(0.12 0.03 260))",
    foreground: "oklch(0.98 0.005 90)",
  },
  bleu: {
    background: "linear-gradient(160deg, oklch(0.34 0.09 248), oklch(0.14 0.07 264))",
    foreground: "oklch(0.98 0.005 90)",
  },
  noir: { background: "#000000", foreground: "#ffffff" },
  sepia: {
    background: "linear-gradient(160deg, oklch(0.94 0.045 78), oklch(0.86 0.055 70))",
    foreground: "oklch(0.26 0.05 55)",
  },
  blanc: { background: "#ffffff", foreground: "#14110d" },
};

export const DEFAULT_TEXT_SHADOW = "0 4px 24px oklch(0 0 0 / 0.5)";

/**
 * Variables applied on the wrapper of a slide:
 *  - `--slide-bg`/`--slide-fg`: preset background, optionally with the chosen
 *    media picture layered on top (`center / cover`),
 *  - `--slide-font-scale`, `--slide-align`, `--slide-text-shadow`: the
 *    readability controls of the settings, consumed by `styles.css`.
 */
export function slideTheme(settings: AppSettings): SlideTheme {
  const preset = PRESETS[settings.theme.preset];
  const background = settings.theme.background
    ? `url("${mediaUrl(settings.theme.background)}") center / cover no-repeat, ${preset.background}`
    : preset.background;

  return {
    "--slide-bg": background,
    "--slide-fg": preset.foreground,
    "--slide-font-scale": String(settings.theme.fontScale),
    "--slide-align": settings.theme.align,
    "--slide-text-shadow": settings.theme.shadow ? DEFAULT_TEXT_SHADOW : "none",
  };
}

/** Human name of a keyboard key, for the shortcut hints in the UI. */
export function describeKey(key: string): string {
  const named: Record<string, string> = {
    ArrowRight: "→",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Escape: "Échap",
    " ": "Espace",
    PageDown: "Page bas",
    PageUp: "Page haut",
  };

  if (named[key]) return named[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}
