import { describe, expect, it } from "vitest";
import { searchBible, verseSlides, type Bible } from "./bible";

const bible: Bible = {
  translation: "Test",
  books: [
    { name: "Jean", abbr: "jn", chapters: [["v1", "v2", "v3"], ["w1"]] },
    { name: "Marc", abbr: "mc", chapters: [["amour du prochain"]] },
  ],
};

describe("verseSlides", () => {
  it("builds one slide per verse in the range", () => {
    const slides = verseSlides(bible, 0, 0, 1, 3);
    expect(slides.map((s) => s.label)).toEqual(["Jean 1:1", "Jean 1:2", "Jean 1:3"]);
    expect(slides.map((s) => s.text)).toEqual(["v1", "v2", "v3"]);
  });

  it("swaps inverted ranges and clamps to the chapter", () => {
    const slides = verseSlides(bible, 0, 0, 3, 2);
    expect(slides.map((s) => s.label)).toEqual(["Jean 1:2", "Jean 1:3"]);
    expect(verseSlides(bible, 0, 1, 1, 99)).toHaveLength(1);
  });
});

describe("searchBible", () => {
  it("finds verses case-insensitively and ignores short queries", () => {
    expect(searchBible(bible, "AMOUR")).toHaveLength(1);
    expect(searchBible(bible, "am")[0]?.label).toBeUndefined();
  });
});
