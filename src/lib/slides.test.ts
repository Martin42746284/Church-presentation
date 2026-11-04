import { describe, expect, it } from "vitest";
import { toSlides } from "./slides";

describe("toSlides", () => {
  it("splits a section longer than maxLines", () => {
    const s = toSlides("[Couplet]\na\nb\nc\nd\ne", "X", 4);
    expect(s.length).toBe(2);
    expect(s[1]?.text).toBe("e");
  });
  it("keeps sections separate", () => {
    expect(toSlides("[A]\na\n[B]\nb", "X").map((s) => s.label)).toEqual(["A", "B"]);
  });
});
