import { parseLyrics } from "@/lib/slides";

/**
 * Stanza helpers for the editor's "barre de liste de strophe".
 *
 * The projection keeps reading `[Couplet 1]`-style lyrics; this module only
 * makes them editable one stanza at a time. Desktop-only: the web app keeps
 * its own text area.
 */
export type Stanza = { label: string; lines: string[] };

/** Parse stored lyrics into the stanza list shown in the editor. */
export function stanzasOf(raw: string): Stanza[] {
  return parseLyrics(raw).map((section) => ({ label: section.label, lines: [...section.lines] }));
}

/** Serialize the stanza list back into lyrics the projection understands. */
export function serializeStanzas(stanzas: Stanza[]): string {
  return stanzas
    .map((stanza) => {
      // Blank lines split blocks in the projection format: they are useless
      // inside a stanza and would make the round-trip unstable.
      const lines = stanza.lines.filter((line) => line.trim() !== "");
      if (lines.length === 0) return "";
      return `[${stanza.label.trim() || "Strophe"}]\n${lines.join("\n")}`;
    })
    .filter((block) => block !== "")
    .join("\n\n");
}

/** Slides a single stanza produces (mirrors `toSlides` without the rest). */
export function stanzaSlides(stanza: Stanza, maxLines: number): number {
  const lines = stanza.lines.filter((line) => line.trim() !== "");
  if (lines.length === 0) return 0;
  return Math.ceil(lines.length / Math.max(1, maxLines));
}

/** Next auto-label: "Couplet 1" → "Couplet 2", anything else → "Couplet n". */
export function nextLabel(stanzas: Stanza[]): string {
  const numbers = stanzas
    .map((stanza) => stanza.label.match(/^(.*?)\s(\d+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => Number(match[2]));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;

  return `Couplet ${max + 1}`;
}
