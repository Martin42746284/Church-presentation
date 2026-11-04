import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon, Play, Plus, Trash2, Upload } from "lucide-react";
import { api, mediaUrl, type MediaRecord } from "@app/api";
import { Badge, Btn } from "@app/components/ui";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const byName = (left: MediaRecord, right: MediaRecord) => left.name.localeCompare(right.name);
const titleOf = (record: MediaRecord) => record.name.replace(/\.[^.]+$/, "");

/**
 * Media library (phase 7): import images/videos, preview them and push them
 * into the current program as a `media` item. Files live in the user data
 * directory and are served by the local API.
 */
export function MediaPanel({
  ready,
  canAdd,
  onAdd,
  onProject,
}: {
  /** The API base URL is known (backend healthy). */
  ready: boolean;
  /** A program is selected, so items can be appended to it. */
  canAdd: boolean;
  onAdd: (media: MediaRecord) => void;
  onProject: (media: MediaRecord) => void;
}) {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setError(null);

    void api
      .listMedia()
      .then((records) => {
        if (alive) setItems(records);
      })
      .catch((failure: unknown) => {
        if (alive) setError(message(failure));
      });

    return () => {
      alive = false;
    };
  }, [ready, reload]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.uploadMedia(file);
      setItems((list) => [...list, created].sort(byName));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = (record: MediaRecord) => {
    if (!window.confirm(`Supprimer le média « ${record.name} » ?`)) return;
    setError(null);
    void api
      .deleteMedia(record.name)
      .then(() => setItems((list) => list.filter((entry) => entry.name !== record.name)))
      .catch((failure: unknown) => setError(message(failure)));
  };

  const add = (record: MediaRecord) => {
    setNotice(`« ${titleOf(record)} » ajouté au programme.`);
    onAdd(record);
  };

  const project = (record: MediaRecord) => {
    setNotice(`« ${titleOf(record)} » envoyé à la projection.`);
    onProject(record);
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          aria-label="Choisir un fichier média"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Btn
          variant="outline"
          className="flex-1 justify-center"
          disabled={!ready || busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={14} /> {busy ? "Import…" : "Importer"}
        </Btn>
        <Btn
          variant="outline"
          className="px-2"
          title="Recharger la bibliothèque"
          onClick={() => setReload((count) => count + 1)}
        >
          ↻
        </Btn>
      </div>

      {(error || notice) && (
        <p
          className={`shrink-0 border-b px-2 py-1.5 text-xs ${
            error ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
          }`}
        >
          {error ?? notice}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
          >
            Fermer
          </button>
        </p>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {items.map((record) => (
          <li key={record.name} className="rounded-md border border-input p-1.5">
            <div className="relative aspect-video overflow-hidden rounded bg-black">
              {record.kind === "video" ? (
                <video
                  src={mediaUrl(record.name)}
                  preload="metadata"
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={mediaUrl(record.name)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white">
                {record.kind === "video" ? "Vidéo" : "Image"}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1">
              <span
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={record.name}
              >
                {record.name}
              </span>
              <button
                type="button"
                title="Projeter directement"
                aria-label={`Projeter ${record.name}`}
                disabled={!ready}
                onClick={() => project(record)}
                className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-30"
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                title={canAdd ? "Ajouter au programme" : "Sélectionnez un programme"}
                aria-label={`Ajouter ${record.name} au programme`}
                disabled={!canAdd}
                onClick={() => add(record)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                title="Supprimer ce média"
                aria-label={`Supprimer ${record.name}`}
                onClick={() => remove(record)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}

        {items.length === 0 && !error && (
          <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            {ready ? (
              <span className="flex flex-col items-center gap-1">
                <ImageIcon size={18} className="opacity-60" />
                Aucun média : importez une image ou une vidéo à projeter.
                <span className="flex items-center gap-1 text-[10px] opacity-75">
                  <Film size={11} /> images et vidéos, 300 Mo maximum
                </span>
              </span>
            ) : (
              "Serveur local indisponible."
            )}
          </li>
        )}
      </ul>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t px-2 py-1.5 text-[11px] text-muted-foreground">
        <Badge ok={ready}>{ready ? `${items.length} média(s)` : "HORS LIGNE"}</Badge>
        <span className="truncate">▶ Projeter · + Programme</span>
      </footer>
    </>
  );
}
