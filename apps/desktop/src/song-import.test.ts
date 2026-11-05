import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { parseSongImport } from "@app/song-import";

describe("parseSongImport", () => {
  it("reads plain text with the title on the first line", () => {
    expect(parseSongImport("chant.txt", "Grâce infinie\n\nParoles\nDeuxième ligne")).toEqual([
      { title: "Grâce infinie", lyrics: "Paroles\nDeuxième ligne", lang: "fr" },
    ]);
  });

  it("reads Markdown headings as the song title", () => {
    expect(parseSongImport("chant.md", "# Amazing Grace\n\nHow sweet the sound")).toEqual([
      { title: "Amazing Grace", lyrics: "How sweet the sound", lang: "fr" },
    ]);
  });

  it("reads standard and legacy collection JSON", () => {
    expect(
      parseSongImport(
        "chants.json",
        JSON.stringify({
          table_hira: [{ _id: 1, title: "Hira", content: "<p>Andriamanitra&nbsp;ô!</p>" }],
        }),
      ),
    ).toEqual([
      {
        title: "Hira",
        lyrics: "Andriamanitra ô!",
        author: null,
        lang: "mg",
        category: null,
        collection: "Hira",
      },
    ]);

    expect(
      parseSongImport("chants.json", JSON.stringify([{ title: "Chant", lyrics: "Paroles" }])),
    ).toEqual([
      {
        title: "Chant",
        lyrics: "Paroles",
        author: null,
        lang: "fr",
        category: null,
        collection: null,
      },
    ]);
  });

  it("follows presentation order when reading a PowerPoint", () => {
    const archive = zipSync({
      "ppt/presentation.xml": strToU8(
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="rId2"/><p:sldId r:id="rId1"/></p:sldIdLst></p:presentation>',
      ),
      "ppt/_rels/presentation.xml.rels": strToU8(
        '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
      ),
      "ppt/slides/slide1.xml": strToU8("<p:sld><a:p><a:r><a:t>Deuxième</a:t></a:r></a:p></p:sld>"),
      "ppt/slides/slide2.xml": strToU8(
        "<p:sld><a:p><a:r><a:t>Première</a:t></a:r></a:p><a:p><a:r><a:t>Grâce &amp; paix</a:t></a:r></a:p></p:sld>",
      ),
    });

    expect(parseSongImport("Mon chant.pptx", archive)).toEqual([
      { title: "Mon chant", lyrics: "Première\nGrâce & paix\nDeuxième", lang: "fr" },
    ]);
  });

  it("rejects unsupported, empty, and invalid formats with an explanation", () => {
    expect(() => parseSongImport("chant.txt", "Pas de paroles")).toThrow(
      "titre sur la première ligne",
    );
    expect(() => parseSongImport("document.docx", "text")).toThrow("Format non pris en charge");
    expect(() => parseSongImport("chants.json", "not-json")).toThrow("JSON invalide");
  });
});
