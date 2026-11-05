import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Btn, Field, inputClass } from "@app/components/ui";
import type { LibrarySong } from "@app/api";
import { toSlides } from "@/lib/slides";

type Meta = Pick<LibrarySong, "title" | "author" | "lang" | "category" | "collection">;

const metaOf = (song: LibrarySong): Meta => ({
  title: song.title,
  author: song.author,
  lang: song.lang,
  category: song.category,
  collection: song.collection,
});

const sameMeta = (left: Meta, right: Meta) =>
  left.title === right.title &&
  left.author === right.author &&
  left.lang === right.lang &&
  left.category === right.category &&
  left.collection === right.collection;

/**
 * Middle column: compact song details above one continuous lyrics editor.
 *
 * A blank line separates stanzas, while each non-empty line is one verse.
 */
export function SongEditor({
  song,
  maxLines,
  saving,
  canAddToProgram,
  onSave,
  onDelete,
  onAddToProgram,
  onCreate,
}: {
  song: LibrarySong | null;
  maxLines: number;
  saving: boolean;
  canAddToProgram: boolean;
  onSave: (draft: LibrarySong) => void;
  onDelete: () => void;
  onAddToProgram: () => void;
  onCreate: () => void;
}) {
  // Mounted per song id: the draft starts from the stored song and lives until
  // another song is picked (or the page reloads).
  const [meta, setMeta] = useState<Meta>(() => metaOf(song ?? ({} as LibrarySong)));
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");

  const draft: LibrarySong | null = song ? { ...song, ...meta, lyrics } : null;

  const patchMeta = (changes: Partial<Meta>) => setMeta((value) => ({ ...value, ...changes }));

  const dirty =
    Boolean(song) &&
    (!sameMeta(meta, metaOf(song ?? ({} as LibrarySong))) || lyrics !== (song?.lyrics ?? ""));
  const valid = Boolean(draft && draft.title.trim() && lyrics.trim());
  const slides = draft ? toSlides(lyrics, draft.title, maxLines).length : 0;

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Éditeur de chant
        </h2>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {saving ? (
            <span role="status">Enregistrement…</span>
          ) : (
            dirty && <span className="rounded bg-destructive/20 px-1.5 py-0.5">modifié</span>
          )}
          {slides > 0 && <span>{slides} diapositive(s)</span>}
        </span>
      </header>

      {draft ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b p-3">
            <Field label="Titre">
              <input
                className={inputClass}
                value={meta.title}
                onChange={(event) => patchMeta({ title: event.target.value })}
              />
            </Field>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Détails du chant
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="Auteur">
                  <input
                    className={inputClass}
                    value={meta.author}
                    onChange={(event) => patchMeta({ author: event.target.value })}
                  />
                </Field>
                <Field label="Langue">
                  <input
                    className={inputClass}
                    value={meta.lang}
                    onChange={(event) => patchMeta({ lang: event.target.value })}
                  />
                </Field>
                <Field label="Catégorie">
                  <input
                    className={inputClass}
                    value={meta.category}
                    onChange={(event) => patchMeta({ category: event.target.value })}
                  />
                </Field>
                <Field label="Recueil" hint="Regroupe les chants dans la bibliothèque.">
                  <input
                    className={inputClass}
                    value={meta.collection}
                    placeholder="Ex. : Louange 2026"
                    onChange={(event) => patchMeta({ collection: event.target.value })}
                  />
                </Field>
              </div>
            </details>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <Field
              label="Paroles"
              hint="Une ligne par vers ; laissez une ligne vide entre les strophes."
              className="flex min-h-0 flex-1 flex-col"
            >
              <textarea
                className={`${inputClass} min-h-[120px] flex-1 resize-none font-sans text-sm leading-relaxed`}
                value={lyrics}
                onChange={(event) => setLyrics(event.target.value)}
                spellCheck={false}
              />
            </Field>
          </div>

          <footer className="flex shrink-0 flex-wrap gap-2 border-t p-3">
            <Btn onClick={() => onSave(draft)} disabled={!dirty || !valid || saving}>
              <Save size={14} /> Enregistrer
            </Btn>
            <Btn variant="outline" onClick={onAddToProgram} disabled={!canAddToProgram}>
              <Plus size={14} /> Ajouter au programme
            </Btn>
            <Btn variant="outline" onClick={onDelete} title="Supprimer ce chant">
              <Trash2 size={14} /> Supprimer
            </Btn>
          </footer>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez un chant dans la bibliothèque pour le modifier.
          </p>
          <Btn onClick={onCreate}>
            <Plus size={14} /> Créer un chant
          </Btn>
        </div>
      )}
    </section>
  );
}
