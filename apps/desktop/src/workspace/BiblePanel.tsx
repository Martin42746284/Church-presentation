import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Plus, Search, X } from "lucide-react";
import {
  api,
  type BibleBook,
  type BibleChapter,
  type BibleHit,
  type BibleTranslation,
  type PassageSelection,
} from "@app/api";
import { Btn } from "@app/components/ui";
import { parseBibleReference, suggestBibleBooks } from "@app/bible-reference";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const DEFAULT_BOOK = 42; // Jean

/**
 * Bible tab: book/chapter navigation, verse range selection and FTS5 search,
 * with actions to project the selected passage directly or add it to a program.
 */
export function BiblePanel({
  ready,
  canAdd,
  onAddPassage,
  onProjectPassage,
}: {
  /** The API base URL is known (Electron reports it once the server is up). */
  ready: boolean;
  canAdd: boolean;
  onAddPassage: (selection: PassageSelection) => void;
  onProjectPassage: (selection: PassageSelection) => void;
}) {
  const [translations, setTranslations] = useState<BibleTranslation[] | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [book, setBook] = useState(DEFAULT_BOOK);
  const [chapter, setChapter] = useState(1);
  const [passage, setPassage] = useState<BibleChapter | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BibleHit[]>([]);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [projectSelectionPending, setProjectSelectionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translation =
    translations?.find((entry) => entry.code === selectedCode) ??
    translations?.find((entry) => entry.language === "mg") ??
    translations?.[0] ??
    null;
  const code = translation?.code;
  const chapterLabel = translation?.language === "mg" ? "Toko" : "Chapitre";
  const chapterOptionLabel = translation?.language === "mg" ? "Toko :" : "Chapitre";

  /* ------------------------------------------------------ books & chapters */

  useEffect(() => {
    if (!ready) return;
    let alive = true;

    void (async () => {
      try {
        const list = await api.listBibleTranslations();
        if (!alive) return;
        setTranslations(list);
        setSelectedCode((current) =>
          current && list.some((entry) => entry.code === current)
            ? current
            : (list.find((entry) => entry.language === "mg")?.code ?? list[0]?.code ?? null),
        );
      } catch (error) {
        if (alive) setError(message(error));
      }
    })();

    return () => {
      alive = false;
    };
  }, [ready]);

  useEffect(() => {
    if (!code) return;
    let alive = true;

    void (async () => {
      try {
        const payload = await api.listBibleBooks(code);
        if (!alive) return;
        setBooks(payload.data);
        const initialBook =
          payload.data.find((entry) => entry.index === DEFAULT_BOOK) ?? payload.data[0];
        if (initialBook) {
          setBook(initialBook.index);
          setChapter(1);
        }
        setQuery("");
        setHits([]);
      } catch (error) {
        if (alive) setError(message(error));
      }
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let alive = true;

    void api
      .bibleChapter(book, chapter, code)
      .then((payload) => {
        if (!alive) return;
        setPassage(payload);
        setError(null);
      })
      .catch((error) => {
        if (!alive) return;
        setProjectSelectionPending(false);
        setError(message(error));
      });

    return () => {
      alive = false;
    };
  }, [code, book, chapter]);

  /* -------------------------------------------------------------- search */

  const referenceQuery = useMemo(() => parseBibleReference(query, books), [query, books]);
  const bookSuggestions = useMemo(() => suggestBibleBooks(query, books), [query, books]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2 || !code || /\d\s*:/.test(needle) || bookSuggestions.length > 0) {
      setHits([]);
      return;
    }

    let alive = true;
    const timer = window.setTimeout(() => {
      void api
        .bibleSearch(needle, code)
        .then((payload) => alive && setHits(payload.data))
        .catch((error) => alive && setError(message(error)));
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, code, bookSuggestions.length]);

  const referenceSearch = /\d\s*:/.test(query);
  const searching = query.trim().length >= 2 && !referenceSearch && bookSuggestions.length === 0;
  const currentBook = books.find((entry) => entry.index === book) ?? null;

  const selectedVerses = useMemo(() => {
    if (!passage) return [];
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    return passage.data.filter((verse) => verse.n >= low && verse.n <= high);
  }, [passage, from, to]);

  const ref = currentBook
    ? `${currentBook.name} ${chapter}:${Math.min(from, to)}${to !== from ? `-${Math.max(from, to)}` : ""}`
    : "";

  const selectRange = (start: number, end: number) => {
    setFrom(Math.min(start, end));
    setTo(Math.max(start, end));
    setProjectSelectionPending(true);
  };

  useEffect(() => {
    if (!referenceQuery || !/[-–—]\s*\d+\s*$/.test(query)) return;

    const timer = window.setTimeout(() => {
      if (
        !passage ||
        passage.book.index !== referenceQuery.book ||
        passage.chapter !== referenceQuery.chapter
      ) {
        setPassage(null);
      }
      setBook(referenceQuery.book);
      setChapter(referenceQuery.chapter);
      setFrom(referenceQuery.from);
      setTo(referenceQuery.to);
      setProjectSelectionPending(true);
      setQuery("");
      setHits([]);
      setError(null);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [referenceQuery, query, passage]);

  useEffect(() => {
    if (
      !projectSelectionPending ||
      !passage ||
      passage.book.index !== book ||
      passage.chapter !== chapter ||
      !currentBook ||
      selectedVerses.length === 0
    ) {
      return;
    }

    onProjectPassage({
      ref,
      translation: translation?.translation ?? "",
      book,
      chapter,
      from: Math.min(from, to),
      to: Math.max(from, to),
      verses: selectedVerses.map((verse) => ({
        label: `${currentBook.name} ${chapter}:${verse.n}`,
        text: verse.text,
      })),
    });
    setProjectSelectionPending(false);
  }, [
    projectSelectionPending,
    passage,
    book,
    chapter,
    currentBook,
    selectedVerses,
    onProjectPassage,
    ref,
    translation?.translation,
    from,
    to,
  ]);

  const selectVerse = (verse: number, extend: boolean) => {
    if (extend) {
      // Shift+click extends the current range from its first verse.
      const anchor = Math.min(from, to);
      selectRange(anchor, verse);
      return;
    }
    selectRange(verse, verse);
  };

  const goToHit = (hit: BibleHit) => {
    setBook(hit.book);
    setChapter(hit.chapter);
    selectRange(hit.verse, hit.verse);
    setQuery("");
    setHits([]);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selected = referenceQuery;
    if (selected) {
      if (
        !passage ||
        passage.book.index !== selected.book ||
        passage.chapter !== selected.chapter
      ) {
        setPassage(null);
      }
      setBook(selected.book);
      setChapter(selected.chapter);
      selectRange(selected.from, selected.to);
      setQuery("");
      setHits([]);
      setError(null);
      return;
    }
    if (/\d\s*:/.test(query)) {
      setError("Référence introuvable. Vérifiez le livre, le chapitre et les versets.");
    }
  };

  const addPassage = () => {
    if (!passage || !currentBook || selectedVerses.length === 0) return;

    onAddPassage({
      ref,
      translation: translation?.translation ?? "",
      book,
      chapter,
      from: Math.min(from, to),
      to: Math.max(from, to),
      verses: selectedVerses.map((verse) => ({
        label: `${currentBook.name} ${chapter}:${verse.n}`,
        text: verse.text,
      })),
    });

    setFrom(1);
    setTo(1);
  };

  const acceptBookSuggestion = (suggestedBook: BibleBook) => {
    const referenceSuffix = query.match(/^\s*.*?\s+(\d+\s*:\s*.*)$/)?.[1];
    setBook(suggestedBook.index);
    if (referenceSuffix) {
      setQuery(`${suggestedBook.name} ${referenceSuffix}`);
    } else {
      setChapter(1);
      setFrom(1);
      setTo(1);
      setPassage(null);
      setProjectSelectionPending(false);
      setQuery(`${suggestedBook.name} `);
    }
    setHits([]);
  };

  if (translations === null) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {error ?? "Chargement de la Bible…"}
      </p>
    );
  }

  if (translations.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <BookOpen size={20} className="mx-auto mb-2" />
        Aucune traduction importée. Les fichiers bibliques configurés sont importés au démarrage du
        serveur local.
      </div>
    );
  }

  return (
    <>
      <div className="relative z-20 border-b">
        <form onSubmit={submitSearch} className="flex items-center gap-2 px-3 py-2">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Tab" && bookSuggestions[0]) {
                event.preventDefault();
                acceptBookSuggestion(bookSuggestions[0]);
              }
            }}
            placeholder="Rechercher un texte ou une référence (Jaona 3:1-19)…"
            aria-label="Rechercher un texte ou une référence dans la Bible"
            aria-autocomplete="list"
            aria-expanded={bookSuggestions.length > 0}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => {
                setQuery("");
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            aria-label="Rechercher"
            title={referenceQuery ? "Afficher cette référence" : "Rechercher dans le texte"}
            className="shrink-0 rounded p-1 text-primary hover:bg-muted"
          >
            <Search size={14} />
          </button>
        </form>
        {bookSuggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Suggestions de livres bibliques"
            className="absolute inset-x-2 top-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          >
            {bookSuggestions.map((suggestion, index) => (
              <li key={suggestion.index} role="option" aria-selected={index === 0}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => acceptBookSuggestion(suggestion)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                    index === 0 ? "bg-muted" : ""
                  }`}
                >
                  <span className="font-medium">{suggestion.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{suggestion.abbr}</span>
                  {index === 0 && (
                    <span className="float-right text-xs text-muted-foreground">Tab</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-b px-3 py-2">
        <p className="truncate text-xs font-semibold">{translation?.translation}</p>
        {translations.length > 1 && (
          <select
            aria-label="Traduction"
            value={code ?? ""}
            onChange={(event) => setSelectedCode(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
          >
            {translations.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.translation}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Livre"
          value={book}
          onChange={(event) => {
            setBook(Number(event.target.value));
            setChapter(1);
            setFrom(1);
            setTo(1);
          }}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
        >
          {books.map((entry) => (
            <option key={entry.index} value={entry.index}>
              {entry.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <select
            aria-label={chapterLabel}
            value={chapter}
            onChange={(event) => {
              setChapter(Number(event.target.value));
              setFrom(1);
              setTo(1);
            }}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
          >
            {Array.from({ length: currentBook?.chapters ?? 1 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {chapterOptionLabel} {index + 1}
              </option>
            ))}
          </select>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {currentBook?.verses ?? 0} v.
          </span>
        </div>
      </div>

      {error && (
        <p className="border-b bg-destructive/15 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {searching ? (
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {hits.length === 0 ? (
            <li className="m-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Aucun résultat pour « {query.trim()} ».
            </li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.book}-${hit.chapter}-${hit.verse}`}>
                <button
                  type="button"
                  onClick={() => goToHit(hit)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="block truncate text-xs font-semibold text-primary">
                    {hit.ref}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{hit.text}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : referenceSearch && query.trim().length >= 2 && !referenceQuery ? (
        <p className="m-2 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          Saisissez une référence valide, par exemple « Jaona 3:1-19 », puis appuyez sur Entrée.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {(passage?.data ?? []).map((verse) => {
            const active = verse.n >= Math.min(from, to) && verse.n <= Math.max(from, to);
            return (
              <li key={verse.n}>
                <button
                  type="button"
                  onClick={(event) => selectVerse(verse.n, event.shiftKey)}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${
                    active ? "bg-primary/20" : "hover:bg-muted"
                  }`}
                >
                  <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">
                    {verse.n}
                  </span>
                  <span className="text-[13px] leading-snug">{verse.text}</span>
                </button>
              </li>
            );
          })}
          {(passage?.data ?? []).length === 0 && (
            <li className="m-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Chapitre introuvable.
            </li>
          )}
        </ul>
      )}

      <div className="space-y-1.5 border-t p-2">
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate font-semibold text-foreground">{ref || "—"}</span>
          <span className="shrink-0">{selectedVerses.length} verset(s) · Maj+clic = plage</span>
        </div>
        <Btn
          variant="outline"
          className="w-full justify-center"
          disabled={!canAdd || selectedVerses.length === 0}
          title={canAdd ? "Ajouter le passage au programme" : "Créez d'abord un programme"}
          onClick={addPassage}
        >
          <Plus size={14} /> Ajouter au programme
        </Btn>
      </div>
    </>
  );
}
