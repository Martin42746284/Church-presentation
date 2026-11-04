import type { Slide } from "./slides";

export type BibleBook = { name: string; abbr: string; chapters: string[][] };
export type Bible = { translation: string; books: BibleBook[] };

let cache: Promise<Bible> | null = null;

/** Lazy-load the bundled Louis Segond 1910 Bible (fetched once, then cached). */
export function loadBible(): Promise<Bible> {
  if (!cache) {
    cache = fetch("/bible-ls1910.json").then((r) => {
      if (!r.ok) throw new Error("Bible introuvable");
      return r.json() as Promise<Bible>;
    });
  }
  return cache;
}

export type VerseRef = { book: number; chapter: number; verse: number };

/** Build one slide per verse for a range of verses. */
export function verseSlides(bible: Bible, book: number, chapter: number, from: number, to: number): Slide[] {
  const b = bible.books[book];
  const ch = b?.chapters[chapter];
  if (!b || !ch) return [];
  const lo = Math.max(1, Math.min(from, to));
  const hi = Math.min(ch.length, Math.max(from, to));
  const slides: Slide[] = [];
  for (let v = lo; v <= hi; v++) {
    const text = ch[v - 1];
    if (text) slides.push({ label: `${b.name} ${chapter + 1}:${v}`, text, source: bible.translation });
  }
  return slides;
}

export type SearchHit = { ref: VerseRef; label: string; text: string };

/** Case-insensitive substring search across all verses. Returns at most `limit` hits. */
export function searchBible(bible: Bible, query: string, limit = 50): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const hits: SearchHit[] = [];
  for (let bi = 0; bi < bible.books.length && hits.length < limit; bi++) {
    const b = bible.books[bi];
    if (!b) continue;
    for (let ci = 0; ci < b.chapters.length && hits.length < limit; ci++) {
      const ch = b.chapters[ci];
      if (!ch) continue;
      for (let vi = 0; vi < ch.length && hits.length < limit; vi++) {
        const text = ch[vi];
        if (text && text.toLowerCase().includes(q)) {
          hits.push({ ref: { book: bi, chapter: ci, verse: vi + 1 }, label: `${b.name} ${ci + 1}:${vi + 1}`, text });
        }
      }
    }
  }
  return hits;
}
