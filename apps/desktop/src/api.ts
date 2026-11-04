/**
 * REST client for the local API served by `backend/`.
 *
 * The base URL comes from Electron (`backendStatus().url`) so the ephemeral
 * port chosen at startup is honoured; in a plain browser we call `/api`
 * relatively, which the Vite dev server proxies to the backend.
 */

import type { Song } from "@/lib/store";

let base = "";

/**
 * The base URL is shared by every panel *and* every window: the projection
 * window builds media URLs from it, so listeners are notified when it changes
 * (never synchronously — `WorkspacePage` assigns it while rendering).
 */
const baseListeners = new Set<() => void>();

export function setApiBase(url: string | null): void {
  const next = (url ?? "").replace(/\/+$/, "");
  if (next === base) return;
  base = next;
  queueMicrotask(() => {
    for (const listener of baseListeners) listener();
  });
}

export function getApiBase(): string {
  return base;
}

export function subscribeApiBase(listener: () => void): () => void {
  baseListeners.add(listener);
  return () => {
    baseListeners.delete(listener);
  };
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown };

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body } = options;

  let response: Response;
  try {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    response = await fetch(`${base}/api${path}`, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      // `exactOptionalPropertyTypes`: omit the key instead of passing undefined.
      ...(payload === undefined ? {} : { body: payload }),
    });
  } catch {
    throw new ApiError(0, "Le serveur local est injoignable.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Laravel's validation payload carries the first field error, if any. */
async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      errors?: Record<string, string[]>;
    };
    const first = payload.errors ? Object.values(payload.errors).flat()[0] : undefined;
    return first ?? payload.message ?? `${response.status} ${response.statusText}`;
  } catch {
    // Not a JSON body (500 HTML page…): fall back to the status line.
    return `${response.status} ${response.statusText}`;
  }
}

/* ------------------------------------------------------------------ records */

export type SongRecord = {
  id: string;
  title: string;
  author: string | null;
  lang: string;
  category: string | null;
  collection: string | null;
  lyrics: string;
};

export type ProgramItemRecord = {
  id: string;
  position: number;
  kind: string;
  song_id: string | null;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  /** Content frozen when the program was saved (phase 6). */
  snapshot?: ItemSnapshot | null;
  song?: SongRecord | null;
};

/** One verse of a `verse` item (label = "Jean 3:16"). */
export type VerseBlock = { label: string; text: string };

/**
 * Snapshot of the content an item was built with. Only `song` and `verse`
 * items have one: `text` items already store their content inline.
 */
export type ItemSnapshot = {
  title?: string | null;
  author?: string | null;
  lang?: string | null;
  lyrics?: string;
  ref?: string;
  translation?: string | null;
  verses?: VerseBlock[];
};

export type ProgramRecord = {
  id: string;
  name: string;
  date: string;
  items: ProgramItemRecord[];
};

export type SongInput = {
  title: string;
  author?: string | null;
  lang?: string;
  category?: string | null;
  collection?: string | null;
  lyrics: string;
};

export type ProgramItemInput = {
  kind: string;
  song_id?: string | null;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ProgramInput = {
  name?: string;
  date?: string;
  items?: ProgramItemInput[];
};

/* -------------------------------------------------------------------- bible */

export type BibleTranslation = {
  code: string;
  translation: string;
  language: string;
  source: string;
  edition: string | null;
  retrieved_at: string | null;
  license: string;
  license_url: string | null;
  verse_count: number;
  book_count: number;
};

export type BibleBook = {
  index: number;
  name: string;
  abbr: string;
  chapters: number;
  verses: number;
};

export type BibleChapter = {
  translation: string;
  license: string;
  book: { index: number; name: string; abbr: string };
  chapter: number;
  data: { n: number; text: string }[];
};

export type BibleHit = {
  book: number;
  book_name: string;
  chapter: number;
  verse: number;
  ref: string;
  text: string;
};

/** A passage picked in the Bible panel: books/chapters 0-indexed, verses 1-indexed. */
export type PassageSelection = {
  ref: string;
  translation: string;
  book: number;
  chapter: number;
  from: number;
  to: number;
  verses: VerseBlock[];
};

/* ----------------------------------------------------------------- endpoints */

const data = <T>(payload: { data: T }): T => payload.data;

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const api = {
  listSongs: () => request<{ data: SongRecord[] }>("/songs").then(data),
  createSong: (input: SongInput) =>
    request<{ data: SongRecord }>("/songs", { method: "POST", body: input }).then(data),
  updateSong: (id: string, input: Partial<SongInput>) =>
    request<{ data: SongRecord }>(`/songs/${id}`, { method: "PUT", body: input }).then(data),
  deleteSong: (id: string) => request<void>(`/songs/${id}`, { method: "DELETE" }),

  listPrograms: (options: { archived?: boolean } = {}) =>
    request<{ data: ProgramRecord[] }>(
      `/programs${query({ archived: options.archived ? "only" : undefined })}`,
    ).then(data),
  createProgram: (input: ProgramInput) =>
    request<{ data: ProgramRecord }>("/programs", { method: "POST", body: input }).then(data),
  updateProgram: (id: string, input: ProgramInput) =>
    request<{ data: ProgramRecord }>(`/programs/${id}`, { method: "PUT", body: input }).then(data),
  deleteProgram: (id: string) => request<void>(`/programs/${id}`, { method: "DELETE" }),
  duplicateProgram: (id: string) =>
    request<{ data: ProgramRecord }>(`/programs/${id}/duplicate`, { method: "POST" }).then(data),
  archiveProgram: (id: string) =>
    request<{ data: ProgramRecord }>(`/programs/${id}/archive`, { method: "POST" }).then(data),
  restoreProgram: (id: string) =>
    request<{ data: ProgramRecord }>(`/programs/${id}/restore`, { method: "POST" }).then(data),

  listBibleTranslations: () => request<{ data: BibleTranslation[] }>("/bible").then(data),
  listBibleBooks: (translation?: string) =>
    request<{ translation: string; license: string; data: BibleBook[] }>(
      `/bible/books${query({ translation })}`,
    ),
  bibleChapter: (book: number, chapter: number, translation?: string) =>
    request<BibleChapter>(`/bible/chapter${query({ book, chapter, translation })}`),
  bibleSearch: (q: string, translation?: string) =>
    request<{ translation: string; data: BibleHit[] }>(`/bible/search${query({ q, translation })}`),

  listMedia: () => request<{ data: MediaRecord[] }>("/media").then(data),
  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<{ data: MediaRecord }>("/media", form).then(data);
  },
  deleteMedia: (name: string) =>
    request<void>(`/media/${encodeURIComponent(name)}`, { method: "DELETE" }),
};

/* ------------------------------------------------------------------- media */

/** A file of the media library (phase 7): local image or video. */
export type MediaRecord = {
  name: string;
  url: string;
  kind: "image" | "video";
  mime: string;
  size: number;
  modified_at: string;
};

/** Absolute URL of a stored media file (used by `<img>`/`<video>`/background). */
export function mediaUrl(name: string): string {
  return `${base}/api/media/${encodeURIComponent(name)}`;
}

/** Uploads with `FormData`: JSON headers would break the multipart boundary. */
async function upload<T>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
    });
  } catch {
    throw new ApiError(0, "Le serveur local est injoignable.");
  }

  if (!response.ok) throw new ApiError(response.status, await readError(response));
  return (await response.json()) as T;
}

/* ------------------------------------------------- mapping to domain types */

/** A song of the library: the shared `Song` plus its recueil (collection). */
export type LibrarySong = Song & { collection: string };

/** `null` columns of the database become the empty strings the UI expects. */
export function toDomainSong(record: SongRecord): LibrarySong {
  return {
    id: record.id,
    title: record.title,
    author: record.author ?? "",
    lang: record.lang || "fr",
    category: record.category ?? "",
    collection: record.collection ?? "",
    lyrics: record.lyrics,
  };
}

/** The workspace stores API records and derives this shape for the slides. */
export function toDomainProgram(record: ProgramRecord) {
  const items = [...record.items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      songId: item.song_id,
      title: item.title,
      body: item.body,
      payload: item.payload,
      snapshot: item.snapshot ?? null,
    }));

  return { id: record.id, name: record.name, date: record.date.slice(0, 10), items };
}

export type ProgramViewItem = ReturnType<typeof toDomainProgram>["items"][number];

/** Drops the item id: the API rebuilds the list from scratch on every save. */
export function toItemInput({
  kind,
  song_id,
  title,
  body,
  payload,
}: ProgramItemRecord): ProgramItemInput {
  return { kind, song_id, title, body, payload };
}
