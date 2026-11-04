import type { BibleBook } from "@app/api";

export type ParsedBibleReference = {
  book: number;
  chapter: number;
  from: number;
  to: number;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const words = (value: string): string[] =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

export function suggestBibleBooks(input: string, books: BibleBook[], limit = 6): BibleBook[] {
  const referenceMatch = input.match(/^\s*(.*?)\s+\d+(?:\s*:.*)?\s*$/);
  const searchName = normalize(referenceMatch?.[1] ?? input.trim());
  if (!searchName || !Number.isSafeInteger(limit) || limit < 1) return [];

  const ranked = books.flatMap((book) => {
    const name = normalize(book.name);
    const abbreviation = normalize(book.abbr);
    const nameWords = words(book.name);
    let score: number | null = null;

    if (abbreviation === searchName) score = 0;
    else if (name === searchName) score = 1;
    else if (name.startsWith(searchName)) score = 2;
    else if (nameWords.some((word) => word.startsWith(searchName))) score = 3;
    else if (abbreviation.startsWith(searchName)) score = 4;
    else if (searchName.length >= 3 && nameWords.some((word) => isOneEditAway(word, searchName))) {
      score = 5;
    }

    return score === null ? [] : [{ book, score }];
  });

  return ranked
    .sort((left, right) => left.score - right.score || left.book.index - right.book.index)
    .slice(0, limit)
    .map(({ book }) => book);
}

function isOneEditAway(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return differences + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

/** Parses references such as "Jaona 3 : 1 - 19", including fuzzy book-word matches. */
export function parseBibleReference(
  input: string,
  books: BibleBook[],
): ParsedBibleReference | null {
  const match = input.match(/^\s*(.+?)\s+(\d+)\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/);
  if (!match) return null;

  const [, bookName, chapterText, fromText, toText] = match;
  if (!bookName || !chapterText || !fromText) return null;

  const searchName = normalize(bookName);
  if (!searchName) return null;

  const exact = books.filter((book) => normalize(book.name) === searchName);
  const exactAbbreviation = books.filter((book) => normalize(book.abbr) === searchName);
  const partial = books.filter((book) => {
    const name = normalize(book.name);
    return name.startsWith(searchName) || searchName.startsWith(name);
  });
  const exactWord = books.filter((book) => words(book.name).includes(searchName));
  const partialWord = books.filter((book) =>
    words(book.name).some((word) => word.startsWith(searchName) || searchName.startsWith(word)),
  );
  const fuzzy = books.filter((book) =>
    words(book.name).some((word) => isOneEditAway(word, searchName)),
  );
  const matches =
    exact.length > 0
      ? exact
      : exactAbbreviation.length > 0
        ? exactAbbreviation
        : partial.length > 0
          ? partial
          : exactWord.length > 0
            ? exactWord
            : partialWord.length > 0
              ? partialWord
              : fuzzy;
  if (matches.length !== 1) return null;

  const book = matches[0];
  const chapter = Number(chapterText);
  const from = Number(fromText);
  const to = Number(toText ?? fromText);
  if (
    !book ||
    chapter < 1 ||
    chapter > book.chapters ||
    from < 1 ||
    to < 1 ||
    !Number.isSafeInteger(chapter) ||
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to)
  ) {
    return null;
  }

  return { book: book.index, chapter, from: Math.min(from, to), to: Math.max(from, to) };
}
