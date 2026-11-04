import { describe, expect, it } from "vitest";
import { nextLabel, serializeStanzas, stanzaSlides, stanzasOf } from "./lyrics";

describe("stanzas", () => {
  it("round-trips lyrics written with [Section] headers", () => {
    const raw = "[Couplet 1]\nLigne 1\nLigne 2\n\n[Refrain]\nLe refrain";

    expect(serializeStanzas(stanzasOf(raw))).toBe(raw);
    expect(stanzasOf(raw).map((stanza) => stanza.label)).toEqual(["Couplet 1", "Refrain"]);
  });

  it("gives a label to lyrics written with blank lines only", () => {
    const stanzas = stanzasOf("Ligne 1\nLigne 2\n\nAutre bloc");

    expect(stanzas).toEqual([
      { label: "Bloc 1", lines: ["Ligne 1", "Ligne 2"] },
      { label: "Bloc 2", lines: ["Autre bloc"] },
    ]);
    expect(serializeStanzas(stanzas)).toBe("[Bloc 1]\nLigne 1\nLigne 2\n\n[Bloc 2]\nAutre bloc");
  });

  it("ignores empty stanzas the projection could not show", () => {
    expect(stanzasOf("[Couplet 1]\n\n[Refrain]\nTexte")).toEqual([
      { label: "Refrain", lines: ["Texte"] },
    ]);
  });

  it("drops the blank lines typed inside a stanza", () => {
    expect(serializeStanzas([{ label: "Couplet 1", lines: ["x", "", "y"] }])).toBe(
      "[Couplet 1]\nx\ny",
    );
    expect(serializeStanzas([{ label: "Vide", lines: ["  "] }])).toBe("");
  });

  it("counts the slides of a stanza like the projection does", () => {
    expect(stanzaSlides({ label: "A", lines: ["1", "2", "3", "4", "5"] }, 4)).toBe(2);
    expect(stanzaSlides({ label: "A", lines: ["1", "2"] }, 4)).toBe(1);
    expect(stanzaSlides({ label: "A", lines: [] }, 4)).toBe(0);
  });

  it("keeps numbering when a stanza is appended", () => {
    expect(nextLabel([{ label: "Couplet 3", lines: ["x"] }])).toBe("Couplet 4");
    expect(nextLabel([{ label: "Refrain", lines: ["x"] }])).toBe("Couplet 1");
    expect(nextLabel([])).toBe("Couplet 1");
  });
});
