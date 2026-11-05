import { useSyncExternalStore } from "react";
import { toSlides, type Slide } from "./slides";

export type Song = { id: string; title: string; author: string; lang: string; category: string; lyrics: string };
export type ProgramItem =
  | { id: string; kind: "song"; songId: string }
  | { id: string; kind: "text"; title: string; body: string };
export type Program = { id: string; name: string; date: string; items: ProgramItem[] };
export type Live = {
  slides: Slide[];
  index: number;
  blank: "none" | "black" | "white";
  programId?: string | undefined;
  songId?: string | undefined;
  source?: "bible" | undefined;
  lyricsVisible?: boolean | undefined;
};
export type State = { songs: Song[]; programs: Program[]; live: Live; maxLines: number };

const KEY = "church-presentation-v1";
export const uid = () => Math.random().toString(36).slice(2, 10);

const demo: State = {
  maxLines: 4,
  songs: [
    {
      id: "s1", title: "Grâce infinie", author: "John Newton", lang: "fr", category: "Hymne",
      lyrics: "[Couplet 1]\nGrâce infinie, ô quel beau son\nPour moi, pauvre pécheur\nJ'étais perdu, il m'a trouvé\nAveugle, je vois mieux\n\n[Couplet 2]\nC'est sa grâce qui m'enseigna\nLa crainte et le respect\nEt c'est encore sa grâce qui\nMe garde et me soutient",
    },
    {
      id: "s2", title: "Amazing Grace", author: "John Newton", lang: "en", category: "Hymn",
      lyrics: "[Verse 1]\nAmazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see",
    },
  ],
  programs: [
    {
      id: "p1", name: "Culte du dimanche", date: new Date().toISOString().slice(0, 10),
      items: [
        { id: "i1", kind: "text", title: "Bienvenue", body: "Bienvenue au culte\nTongasoa eto amin'ny fanompoana" },
        { id: "i2", kind: "song", songId: "s1" },
        { id: "i3", kind: "song", songId: "s2" },
      ],
    },
  ],
  live: { slides: [], index: 0, blank: "none" },
};

let state: State = demo;
let loaded = false;
const subs = new Set<() => void>();
const channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...demo, ...JSON.parse(raw) };
  } catch {}
  channel?.addEventListener("message", (e) => {
    state = e.data;
    subs.forEach((f) => f());
  });
}

export function setState(fn: (s: State) => State) {
  load();
  state = fn(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  channel?.postMessage(state);
  subs.forEach((f) => f());
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (f) => { load(); subs.add(f); queueMicrotask(f); return () => subs.delete(f); },
    () => { load(); return sel(state); },
    () => sel(demo),
  );
}

export function programSlides(p: Program, songs: Song[], maxLines: number): Slide[] {
  return p.items.flatMap((it) => {
    if (it.kind === "text") return toSlides(`[${it.title}]\n${it.body}`, it.title, maxLines);
    const s = songs.find((x) => x.id === it.songId);
    return s ? toSlides(s.lyrics, s.title, maxLines) : [];
  });
}

export const goLive = (
  slides: Slide[],
  index = 0,
  programId?: string,
  songId?: string,
  source?: Live["source"],
) =>
  setState((s) => ({
    ...s,
    live: { slides, index, blank: "none", programId, songId, source, lyricsVisible: true },
  }));
export const resetLive = () =>
  setState((s) => ({
    ...s,
    live: { slides: [], index: 0, blank: "none", lyricsVisible: true },
  }));
export const setIndex = (i: number) =>
  setState((s) => ({ ...s, live: { ...s.live, index: Math.max(0, Math.min(s.live.slides.length - 1, i)) } }));
export const setBlank = (b: Live["blank"]) =>
  setState((s) => ({ ...s, live: { ...s.live, blank: s.live.blank === b ? "none" : b } }));
export const toggleLiveLyrics = () =>
  setState((s) => ({
    ...s,
    live: { ...s.live, lyricsVisible: s.live.lyricsVisible === false },
  }));
