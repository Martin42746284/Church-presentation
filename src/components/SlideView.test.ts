import { describe, expect, it } from "vitest";
import { fitSlideText } from "./SlideView";

describe("fitSlideText", () => {
  it("keeps the normal font size when the text already fits", () => {
    expect(fitSlideText(800, (scale) => 600 * scale)).toBe(1);
  });

  it("reduces the font size enough to fit long text", () => {
    const fittedScale = fitSlideText(500, (scale) => 1000 * scale);

    expect(fittedScale).toBeLessThan(1);
    expect(1000 * fittedScale).toBeLessThanOrEqual(500);
  });

  it("uses the smallest supported font size for extremely long text", () => {
    expect(fitSlideText(500, () => 6000)).toBe(0.1);
  });
});
