import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  mergeSettings,
  sanitizeSettings,
  type AppSettings,
} from "./settings";

const clone = (): AppSettings => structuredClone(DEFAULT_SETTINGS);

describe("settings merge", () => {
  it("returns the current settings for anything that is not an object", () => {
    const current = clone();
    expect(mergeSettings(current, null)).toBe(current);
    expect(mergeSettings(current, "theme")).toBe(current);
    expect(mergeSettings(current, [1, 2])).toBe(current);
  });

  it("applies a partial patch without touching the rest", () => {
    const next = mergeSettings(clone(), { theme: { preset: "sepia" } });

    expect(next.theme.preset).toBe("sepia");
    expect(next.theme.fontScale).toBe(1);
    expect(next.announcement).toEqual(DEFAULT_SETTINGS.announcement);
    expect(next.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  });

  it("accepts only supported application appearance modes", () => {
    expect(DEFAULT_SETTINGS.appearance).toBe("light");
    expect(mergeSettings(clone(), { appearance: "light" }).appearance).toBe("light");
    expect(mergeSettings(clone(), { appearance: "dark" }).appearance).toBe("dark");
    expect(mergeSettings(clone(), { appearance: "unknown" }).appearance).toBe("light");
  });

  it("keeps unknown fields out of the result", () => {
    const next = mergeSettings(clone(), {
      theme: { preset: "bleu", evil: true },
      hacker: "ignored",
    } as never);

    expect(next.theme).toEqual({ ...DEFAULT_SETTINGS.theme, preset: "bleu" });
    expect("hacker" in next).toBe(false);
  });

  it("clamps the font scale to the supported range", () => {
    expect(mergeSettings(clone(), { theme: { fontScale: 99 } }).theme.fontScale).toBe(1.4);
    expect(mergeSettings(clone(), { theme: { fontScale: 0.1 } }).theme.fontScale).toBe(0.7);
    expect(mergeSettings(clone(), { theme: { fontScale: 1.234 } }).theme.fontScale).toBe(1.23);
    expect(mergeSettings(clone(), { theme: { fontScale: Number.NaN } }).theme.fontScale).toBe(1);
  });

  it("rejects an unknown preset but accepts every declared one", () => {
    expect(mergeSettings(clone(), { theme: { preset: "arc-en-ciel" } }).theme.preset).toBe("nuit");

    for (const preset of THEME_PRESETS) {
      expect(mergeSettings(clone(), { theme: { preset } }).theme.preset).toBe(preset);
    }
  });

  it("accepts a media background name and a null reset", () => {
    const withImage = mergeSettings(clone(), { theme: { background: "accueil-1.jpg" } });
    expect(withImage.theme.background).toBe("accueil-1.jpg");

    expect(mergeSettings(withImage, { theme: { background: null } }).theme.background).toBeNull();

    const hostile = mergeSettings(clone(), { theme: { background: "../etc/passwd" } });
    expect(hostile.theme.background).toBeNull();
  });

  it("keeps the announcement within bounds", () => {
    const next = mergeSettings(clone(), {
      announcement: { text: "a".repeat(5000), visible: true },
    });

    expect(next.announcement.visible).toBe(true);
    expect(next.announcement.text).toBe("a".repeat(600));

    const untouched = mergeSettings(clone(), { announcement: { visible: "yes" } as never });
    expect(untouched.announcement.visible).toBe(false);
  });

  it("only accepts usable shortcut strings", () => {
    const next = mergeSettings(clone(), {
      shortcuts: { next: "PageDown", prev: "", black: 42 as never },
    });

    expect(next.shortcuts.next).toBe("PageDown");
    expect(next.shortcuts.prev).toBe("ArrowLeft"); // empty string: keep the default
    expect(next.shortcuts.black).toBe("b");
  });

  it("round-trips a full settings file read from disk", () => {
    const stored = mergeSettings(clone(), {
      appearance: "light",
      theme: {
        preset: "blanc",
        background: "fond.png",
        fontScale: 1.1,
        align: "left",
        shadow: false,
      },
      announcement: { text: "Répétition jeudi", visible: true },
      shortcuts: { announce: "n" },
    });

    expect(sanitizeSettings(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("corrupt")).toEqual(DEFAULT_SETTINGS);
  });
});
