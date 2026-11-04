export type Section = { label: string; lines: string[] };
export type Slide = { label: string; text: string; source: string };

/** Parse lyrics written with [Section] headers. Blank lines also split blocks. */
export function parseLyrics(raw: string): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    const m = t.match(/^\[(.+)\]$/);
    if (m) {
      const sec: Section = { label: m[1] ?? "", lines: [] };
      sections.push(sec);
      cur = sec;
    } else if (t === "") {
      if (cur && cur.lines.length) cur = null;
    } else {
      if (!cur) {
        cur = { label: `Bloc ${sections.length + 1}`, lines: [] };
        sections.push(cur);
      }
      cur.lines.push(t);
    }
  }
  return sections.filter((s) => s.lines.length);
}

/** Split sections into slides of at most maxLines lines each. */
export function toSlides(raw: string, source: string, maxLines = 4): Slide[] {
  const out: Slide[] = [];
  for (const s of parseLyrics(raw)) {
    for (let i = 0; i < s.lines.length; i += maxLines) {
      out.push({ label: s.label, text: s.lines.slice(i, i + maxLines).join("\n"), source });
    }
  }
  return out;
}
