import { describe, expect, it } from "vitest";
import { setApiBase } from "@app/api";
import { describeKey, slideTheme, THEME_LABELS } from "./theme";
import {
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  type AppSettings,
  type ThemePreset,
} from "@shared/settings";

const settings = (patch: Partial<AppSettings["theme"]> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  theme: { ...DEFAULT_SETTINGS.theme, ...patch },
});

describe("slide theme", () => {
  it("gives every preset its own background and foreground", () => {
    const backgrounds = THEME_PRESETS.map(
      (preset) => slideTheme(settings({ preset }))["--slide-bg"],
    );
    expect(new Set(backgrounds).size).toBe(THEME_PRESETS.length);

    for (const preset of THEME_PRESETS) {
      expect(THEME_LABELS[preset]).toBeTruthy();
      expect(slideTheme(settings({ preset }))["--slide-fg"]).toBeTruthy();
    }
  });

  it("layers the chosen media picture over the preset background", () => {
    setApiBase("http://127.0.0.1:8123");

    const theme = slideTheme(settings({ preset: "noir", background: "accueil.jpg" }));
    expect(theme["--slide-bg"]).toBe(
      'url("http://127.0.0.1:8123/api/media/accueil.jpg") center / cover no-repeat, #000000',
    );
  });

  it("falls back to the preset gradient without a background picture", () => {
    setApiBase("");
    const theme = slideTheme(settings({ preset: "bleu", background: null }));
    expect(theme["--slide-bg"]).not.toContain("url(");
    expect(theme["--slide-bg"]).toContain("gradient");
  });

  it("exposes the readability controls as CSS variables", () => {
    const theme = slideTheme(settings({ fontScale: 1.25, align: "left", shadow: false }));

    expect(theme["--slide-font-scale"]).toBe("1.25");
    expect(theme["--slide-align"]).toBe("left");
    expect(theme["--slide-text-shadow"]).toBe("none");
    expect(slideTheme(settings())["--slide-text-shadow"]).not.toBe("none");
  });
});

describe("shortcut labels", () => {
  it("reads keys the way the footer does", () => {
    expect(describeKey("ArrowRight")).toBe("→");
    expect(describeKey("ArrowLeft")).toBe("←");
    expect(describeKey("Escape")).toBe("Échap");
    expect(describeKey("b")).toBe("B");
    expect(describeKey("PageDown")).toBe("Page bas");
    expect(describeKey("F5")).toBe("F5");
  });
});

describe("preset labels", () => {
  it("labels every preset in French", () => {
    const presets: ThemePreset[] = [...THEME_PRESETS];
    expect(presets.map((preset) => THEME_LABELS[preset])).toEqual([
      "Nuit",
      "Bleu",
      "Noir",
      "Sépia",
      "Blanc",
    ]);
  });
});
