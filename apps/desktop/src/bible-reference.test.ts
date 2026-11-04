import { describe, expect, it } from "vitest";
import { parseBibleReference, suggestBibleBooks } from "./bible-reference";

const books = [
  { index: 39, name: "Evanjelin’i Matio", abbr: "Mat", chapters: 28, verses: 1071 },
  { index: 42, name: "Jaona", abbr: "Jao", chapters: 21, verses: 879 },
  { index: 43, name: "Jakoba", abbr: "Jak", chapters: 5, verses: 108 },
  { index: 44, name: "Asan'ny Apostoly", abbr: "Asa", chapters: 28, verses: 1007 },
];

describe("parseBibleReference", () => {
  it("parses a verse range with flexible spaces and a small book-name typo", () => {
    expect(parseBibleReference("Jaone 3 : 1 - 19", books)).toEqual({
      book: 42,
      chapter: 3,
      from: 1,
      to: 19,
    });
  });

  it("parses the Jaona 3:1-19 reference used for automatic range selection", () => {
    expect(parseBibleReference("Jaona 3:1-19", books)).toEqual({
      book: 42,
      chapter: 3,
      from: 1,
      to: 19,
    });
  });

  it("matches a short book-name typo to a word in the canonical book title", () => {
    expect(parseBibleReference("Mation 3:5-9", books)).toEqual({
      book: 39,
      chapter: 3,
      from: 5,
      to: 9,
    });
  });

  it("suggests the canonical book for an abbreviation, including a reference prefix", () => {
    expect(suggestBibleBooks("Asa", books)[0]).toEqual(books[3]);
    expect(suggestBibleBooks("Asa 3:5-9", books)[0]).toEqual(books[3]);
    expect(parseBibleReference("Asa 3:5-9", books)).toEqual({
      book: 44,
      chapter: 3,
      from: 5,
      to: 9,
    });
  });

  it("suggests books by one or more typed letters and keeps the best match first", () => {
    expect(suggestBibleBooks("Mat", books)[0]).toEqual(books[0]);
    expect(suggestBibleBooks("Mation", books)[0]).toEqual(books[0]);
    expect(suggestBibleBooks("", books)).toEqual([]);
  });

  it("accepts a single verse and normalizes reversed ranges", () => {
    expect(parseBibleReference("Jaona 3:19-1", books)).toEqual({
      book: 42,
      chapter: 3,
      from: 1,
      to: 19,
    });
    expect(parseBibleReference("Jaona 3:4", books)?.to).toBe(4);
  });

  it("rejects ambiguous names and invalid chapters", () => {
    expect(parseBibleReference("Ja 3:1", books)).toBeNull();
    expect(parseBibleReference("Jaona 22:1", books)).toBeNull();
  });
});
