import { strFromU8, unzipSync } from "fflate";
import type { SongInput } from "@app/api";

type JsonRecord = Record<string, unknown>;

function cleanText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function filenameTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}

function textSong(raw: string, markdown: boolean): SongInput {
  const text = cleanText(raw);
  const lines = text.split("\n");
  const firstLine = lines.findIndex((line) => line.trim() !== "");
  const titleLine = firstLine < 0 ? "" : (lines[firstLine] ?? "").trim();
  const heading = markdown ? titleLine.match(/^#{1,6}\s+(.+?)\s*#*$/) : null;
  const title = heading?.[1] ?? titleLine;
  const lyrics = lines
    .slice(firstLine + 1)
    .join("\n")
    .trim();

  if (!title || !lyrics) {
    throw new Error(
      "Le fichier doit contenir un titre sur la première ligne et des paroles ensuite.",
    );
  }

  return { title, lyrics, lang: "fr" };
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<\s*br\b[^>]*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const hex = code[1]?.toLowerCase() === "x";
        const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[
          code.toLowerCase() as "amp" | "lt" | "gt" | "quot" | "apos" | "nbsp"
        ] ?? entity
      );
    })
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonSongs(raw: string): SongInput[] {
  let value: unknown;
  try {
    value = JSON.parse(cleanText(raw));
  } catch (error) {
    throw new Error(`JSON invalide : ${error instanceof Error ? error.message : String(error)}`);
  }

  const table = isRecord(value) ? value.table_hira : undefined;
  const legacy = Array.isArray(table);
  const records = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.songs)
      ? value.songs
      : legacy
        ? table
        : [value];

  const songs = records.map((entry, index): SongInput => {
    if (!isRecord(entry)) throw new Error(`Chant ${index + 1} : objet JSON attendu.`);
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const content = typeof entry.lyrics === "string" ? entry.lyrics : entry.content;
    const lyrics =
      typeof content === "string" ? (legacy ? decodeHtmlText(content) : content.trim()) : "";
    if (!title || !lyrics) {
      throw new Error(`Chant ${index + 1} : le titre ou les paroles sont absents.`);
    }

    return {
      title,
      lyrics,
      author: typeof entry.author === "string" ? entry.author : null,
      lang: typeof entry.lang === "string" ? entry.lang : legacy ? "mg" : "fr",
      category:
        typeof entry.category === "string"
          ? entry.category
          : typeof entry.namelist === "string"
            ? entry.namelist
            : null,
      collection: legacy ? "Hira" : typeof entry.collection === "string" ? entry.collection : null,
    };
  });

  if (songs.length === 0) throw new Error("Le fichier ne contient aucun chant à importer.");
  return songs;
}

function xmlDecode(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const hex = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return (
      { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
        code.toLowerCase() as "amp" | "lt" | "gt" | "quot" | "apos"
      ] ?? entity
    );
  });
}

function pptxSong(filename: string, bytes: Uint8Array): SongInput {
  let archive: Record<string, Uint8Array>;
  let oversizedSlide = false;
  try {
    archive = unzipSync(bytes, {
      filter: (file) => {
        const relevant =
          file.name === "ppt/presentation.xml" ||
          file.name === "ppt/_rels/presentation.xml.rels" ||
          /^ppt\/slides\/slide\d+\.xml$/.test(file.name);
        if (relevant && file.originalSize > 5 * 1024 * 1024) {
          oversizedSlide = true;
          return false;
        }
        return relevant;
      },
    });
  } catch {
    throw new Error("Le fichier PowerPoint est illisible ou endommagé.");
  }
  if (oversizedSlide) {
    throw new Error("Un fichier de diapositive dépasse la taille maximale de 5 Mo.");
  }

  const read = (path: string) => {
    const file = archive[path];
    return file ? strFromU8(file) : "";
  };
  const presentation = read("ppt/presentation.xml");
  const relationships = read("ppt/_rels/presentation.xml.rels");
  const targets = new Map<string, string>();
  for (const match of relationships.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = match[1]?.match(/\bId="([^"]+)"/)?.[1];
    const target = match[1]?.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) targets.set(id, target.replace(/^\/?ppt\//, "ppt/").replace(/^\//, ""));
  }

  const slidePaths: string[] = [];
  for (const match of presentation.matchAll(/<(?:\w+:)?sldId\b([^>]*)\/?>/g)) {
    const id = match[1]?.match(/(?:\w+:)?id="([^"]+)"/)?.[1];
    const target = id ? targets.get(id) : undefined;
    if (target) {
      slidePaths.push(target.startsWith("ppt/") ? target : `ppt/${target}`);
    }
  }
  if (slidePaths.length === 0) {
    slidePaths.push(
      ...Object.keys(archive)
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort((left, right) => {
          const number = (path: string) => Number(path.match(/slide(\d+)/)?.[1] ?? 0);
          return number(left) - number(right);
        }),
    );
  }

  const paragraphs = slidePaths.flatMap((path) => {
    const xml = read(path);
    return [...xml.matchAll(/<(?:\w+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?p>/g)]
      .map((paragraph) =>
        [...(paragraph[1] ?? "").matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
          .map((run) => xmlDecode(run[1] ?? ""))
          .join(""),
      )
      .filter((paragraph) => paragraph.trim() !== "");
  });
  const lyrics = paragraphs.join("\n").trim();
  const title = filenameTitle(filename);
  if (!title || !lyrics) {
    throw new Error("Aucun texte de chant lisible dans cette présentation.");
  }
  return { title, lyrics, lang: "fr" };
}

export function parseSongImport(filename: string, content: string | Uint8Array): SongInput[] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "json") {
    if (typeof content !== "string") throw new Error("Contenu JSON invalide.");
    return jsonSongs(content);
  }
  if (extension === "pptx") {
    if (typeof content === "string") throw new Error("Contenu PowerPoint invalide.");
    return [pptxSong(filename, content)];
  }
  if (extension === "txt" || extension === "md") {
    if (typeof content !== "string") throw new Error("Contenu texte invalide.");
    return [textSong(content, extension === "md")];
  }
  throw new Error("Format non pris en charge. Formats acceptés : .txt, .md, .json et .pptx.");
}

export async function readSongImport(file: File): Promise<SongInput[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "pptx"
    ? parseSongImport(file.name, new Uint8Array(await file.arrayBuffer()))
    : parseSongImport(file.name, await file.text());
}
