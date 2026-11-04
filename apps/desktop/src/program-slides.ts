import { toSlides, type Slide } from "@/lib/slides";
import type { Song } from "@/lib/store";
import type { PassageSelection, ProgramViewItem, VerseBlock } from "@app/api";

/** A file of the media library referenced by a `media` program item. */
export type MediaRef = { name: string; kind: "image" | "video" };

/**
 * Desktop extension of the shared `Slide` (D6: the web type stays untouched):
 * a media slide carries the file to project instead of lyrics.
 */
export type ProjectionSlide = Slide & { media?: MediaRef };

/** Reads `payload.media` defensively — the payload is user data. */
export function mediaRefOf(item: ProgramViewItem): MediaRef | null {
  const payload = item.payload;
  if (!payload || typeof payload.media !== "string" || payload.media === "") return null;
  return { name: payload.media, kind: payload.kind === "video" ? "video" : "image" };
}

/** `payload.verses` is client data: read it defensively. */
function payloadVerses(payload: Record<string, unknown> | null): VerseBlock[] {
  if (!payload || !Array.isArray(payload.verses)) return [];

  return payload.verses
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null && "text" in entry,
    )
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label : "",
      text: typeof entry.text === "string" ? entry.text : "",
    }));
}

/** Verses of a `verse` item: snapshot first, payload as a fallback. */
export function verseBlocks(item: ProgramViewItem): VerseBlock[] {
  const snapshot = item.snapshot?.verses;
  if (snapshot && snapshot.length > 0) return snapshot;
  return payloadVerses(item.payload);
}

function slidesOfVerses(ref: string, verses: VerseBlock[], maxLines: number): ProjectionSlide[] {
  const raw = verses.map((verse) => `[${verse.label || ref}]\n${verse.text}`).join("\n\n");
  return toSlides(raw, ref, maxLines);
}

/** Slides for a Bible selection projected independently of a program. */
export function slidesOfPassage(selection: PassageSelection, maxLines: number): ProjectionSlide[] {
  return slidesOfVerses(selection.ref, selection.verses, maxLines);
}

/**
 * Slides contributed by one program item.
 *
 * The **snapshot wins**: a program keeps projecting the text it was built with
 * even when the song was edited or deleted afterwards (phase 6).
 */
export function slidesOfItem(
  item: ProgramViewItem,
  songs: Song[],
  maxLines: number,
): ProjectionSlide[] {
  if (item.kind === "media") {
    const media = mediaRefOf(item);
    // A media item without a file projects nothing (the library entry may
    // have been deleted before it was removed from the program).
    if (!media) return [];

    const title = item.title || media.name;
    return [{ label: title, text: "", source: title, media }];
  }

  if (item.kind === "song") {
    const song = songs.find((entry) => entry.id === item.songId) ?? null;
    const lyrics = item.snapshot?.lyrics ?? song?.lyrics;
    const title = item.snapshot?.title ?? song?.title ?? "Chant";

    return lyrics ? toSlides(lyrics, title, maxLines) : [];
  }

  if (item.kind === "verse") {
    const blocks = verseBlocks(item);
    if (blocks.length === 0) return [];

    const ref = item.snapshot?.ref ?? item.title ?? "Passage";
    return slidesOfVerses(ref, blocks, maxLines);
  }

  const title = item.title ?? item.snapshot?.title ?? "Texte";

  return toSlides(`[${title}]\n${item.body ?? ""}`, title, maxLines);
}
