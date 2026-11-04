import { describe, expect, it } from "vitest";
import { toDomainProgram, type ProgramRecord } from "@app/api";
import { slidesOfItem, slidesOfPassage, verseBlocks } from "./program-slides";

const record = (items: ProgramRecord["items"]): ProgramRecord => ({
  id: "p1",
  name: "Culte du dimanche",
  date: "2026-11-08",
  items,
});

const item = (over: Partial<ProgramRecord["items"][number]>): ProgramRecord["items"][number] => ({
  id: "i1",
  position: 0,
  kind: "text",
  song_id: null,
  title: null,
  body: null,
  payload: null,
  ...over,
});

const view = (items: ProgramRecord["items"]) => toDomainProgram(record(items)).items;

describe("program slides", () => {
  it("projects a selected Bible passage without a program", () => {
    const slides = slidesOfPassage(
      {
        ref: "Jean 3:1-10",
        translation: "Louis Segond 1910",
        book: 42,
        chapter: 3,
        from: 1,
        to: 10,
        verses: Array.from({ length: 10 }, (_, index) => ({
          label: `Jean 3:${index + 1}`,
          text: `Texte du verset ${index + 1}`,
        })),
      },
      4,
    );

    expect(slides).toHaveLength(10);
    expect(slides[0]).toMatchObject({
      label: "Jean 3:1",
      text: "Texte du verset 1",
      source: "Jean 3:1-10",
    });
    expect(slides[9]?.label).toBe("Jean 3:10");
  });

  it("projects a song from its snapshot even when the song disappeared", () => {
    const [slide] = slidesOfItem(
      view([
        item({
          kind: "song",
          song_id: null,
          snapshot: { title: "Grâce infinie", lyrics: "[Refrain]\nGrâce infinie" },
        }),
      ])[0]!,
      [],
      4,
    );

    expect(slide?.text).toBe("Grâce infinie");
    expect(slide?.source).toBe("Grâce infinie");
    expect(slide?.label).toBe("Refrain");
  });

  it("falls back to the live song when no snapshot exists", () => {
    const slides = slidesOfItem(
      view([item({ kind: "song", song_id: "s1" })])[0]!,
      [{ id: "s1", title: "Live", author: "", lang: "fr", category: "", lyrics: "[A]\nTexte" }],
      4,
    );

    expect(slides).toHaveLength(1);
    expect(slides[0]?.source).toBe("Live");
  });

  it("projects one slide per verse of a verse item", () => {
    const slides = slidesOfItem(
      view([
        item({
          kind: "verse",
          title: "Jean 3:16-17",
          payload: {
            ref: "Jean 3:16-17",
            verses: [
              { label: "Jean 3:16", text: "Dieu a tant aimé le monde" },
              { label: "Jean 3:17", text: "Car Dieu a envoyé son Fils" },
            ],
          },
        }),
      ])[0]!,
      [],
      4,
    );

    expect(slides.map((slide) => slide.label)).toEqual(["Jean 3:16", "Jean 3:17"]);
    expect(slides[0]?.source).toBe("Jean 3:16-17");
  });

  it("prefers the snapshot of a verse over the payload", () => {
    const itemWithSnapshot = view([
      item({
        kind: "verse",
        title: "Jean 3:16",
        payload: { ref: "Jean 3:16", verses: [{ label: "Jean 3:16", text: "Texte d'origine" }] },
        snapshot: {
          ref: "Jean 3:16",
          translation: "Louis Segond 1910",
          verses: [{ label: "Jean 3:16", text: "Texte figé à l'enregistrement" }],
        },
      }),
    ])[0]!;

    expect(verseBlocks(itemWithSnapshot)).toHaveLength(1);
    expect(slidesOfItem(itemWithSnapshot, [], 4)[0]?.text).toBe("Texte figé à l'enregistrement");
  });

  it("projects a text item with its title", () => {
    const slides = slidesOfItem(
      view([item({ kind: "text", title: "Bienvenue", body: "Tongasoa eto" })])[0]!,
      [],
      4,
    );

    expect(slides).toHaveLength(1);
    expect(slides[0]?.label).toBe("Bienvenue");
    expect(slides[0]?.text).toBe("Tongasoa eto");
  });

  it("projects a media item as a single media slide", () => {
    const slides = slidesOfItem(
      view([
        item({
          kind: "media",
          title: "Diapositive d'accueil",
          payload: { media: "accueil.jpg", kind: "image" },
        }),
      ])[0]!,
      [],
      4,
    );

    expect(slides).toHaveLength(1);
    expect(slides[0]?.media).toEqual({ name: "accueil.jpg", kind: "image" });
    expect(slides[0]?.label).toBe("Diapositive d'accueil");
    expect(slides[0]?.text).toBe("");
  });

  it("keeps the video kind and the file name when the title is missing", () => {
    const slides = slidesOfItem(
      view([item({ kind: "media", payload: { media: "temoignage.mp4", kind: "video" } })])[0]!,
      [],
      4,
    );

    expect(slides[0]?.media?.kind).toBe("video");
    expect(slides[0]?.source).toBe("temoignage.mp4");
  });

  it("projects nothing when a media item lost its file", () => {
    expect(slidesOfItem(view([item({ kind: "media" })])[0]!, [], 4)).toEqual([]);
    expect(
      slidesOfItem(view([item({ kind: "media", payload: { media: "" } })])[0]!, [], 4),
    ).toEqual([]);
  });
});
