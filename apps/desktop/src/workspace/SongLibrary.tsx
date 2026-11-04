import { Fragment, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Btn } from "@app/components/ui";
import type { LibrarySong } from "@app/api";

const uniq = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

/**
 * Content of the library tab: search, a recueil/category filter and a list
 * grouped by recueil — the VideoPsalm "choisir un chant dans un recueil".
 */
export function SongLibrary({
  songs,
  selectedId,
  onSelect,
  onCreate,
}: {
  songs: LibrarySong[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");

  const collections = useMemo(() => uniq(songs.map((song) => song.collection)), [songs]);
  const categories = useMemo(() => uniq(songs.map((song) => song.category)), [songs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const separator = filter.indexOf(":");
    const kind = separator > 0 ? filter.slice(0, separator) : "";
    const value = separator > 0 ? filter.slice(separator + 1) : "";

    return songs.filter((song) => {
      if (kind === "coll" && song.collection.trim() !== value) return false;
      if (kind === "cat" && song.category.trim() !== value) return false;
      if (!needle) return true;
      return [song.title, song.author, song.lyrics].some((entry) =>
        entry.toLowerCase().includes(needle),
      );
    });
  }, [songs, query, filter]);

  /** Group by recueil, then by category: headers only when there is a value. */
  const groups = useMemo(() => {
    const buckets = new Map<string, LibrarySong[]>();
    for (const song of filtered) {
      const key = song.collection.trim() || song.category.trim();
      const bucket = buckets.get(key) ?? [];
      bucket.push(song);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filtered]);

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher…"
          aria-label="Rechercher un chant"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="border-b px-3 py-2">
        <select
          aria-label="Filtrer par recueil ou catégorie"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
        >
          <option value="">Tous les chants</option>
          {collections.length > 0 && (
            <optgroup label="Recueils">
              {collections.map((collection) => (
                <option key={collection} value={`coll:${collection}`}>
                  {collection}
                </option>
              ))}
            </optgroup>
          )}
          {categories.length > 0 && (
            <optgroup label="Catégories">
              {categories.map((category) => (
                <option key={category} value={`cat:${category}`}>
                  {category}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {groups.map(([group, list]) => (
          <Fragment key={group || "sans-regroupement"}>
            {group && (
              <li className="flex items-baseline justify-between px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="truncate">{group}</span>
                <span>{list.length}</span>
              </li>
            )}
            {list.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => onSelect(song.id)}
                  className={`w-full rounded-md px-2.5 py-2 text-left ${
                    selectedId === song.id ? "bg-primary/20" : "hover:bg-muted"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold">
                    {song.title.trim() || "(sans titre)"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {song.author || "—"} · {song.lang || "—"}
                  </span>
                </button>
              </li>
            ))}
          </Fragment>
        ))}
        {groups.length === 0 && (
          <li className="m-1 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {songs.length === 0 ? "Aucun chant pour l'instant." : "Aucun résultat."}
          </li>
        )}
      </ul>

      <footer className="border-t p-2">
        <Btn onClick={onCreate} className="w-full justify-center">
          <Plus size={14} /> Nouveau chant
        </Btn>
      </footer>
    </>
  );
}
