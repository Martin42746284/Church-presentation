import { useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Music,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Btn, Field, inputClass } from "@app/components/ui";
import { toItemInput, type ProgramItemInput, type ProgramRecord } from "@app/api";
import type { Song } from "@/lib/store";

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Agenda panel: the order of service. Every change is sent to the API right
 * away — the panel never keeps its own copy of the items.
 */
export function ProgramPanel({
  programs,
  program,
  songs,
  itemStarts,
  selectedSong,
  saving,
  archivedView,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onItems,
  onPresent,
  onDuplicate,
  onArchive,
  onRestore,
  onToggleArchived,
}: {
  programs: ProgramRecord[];
  program: ProgramRecord | null;
  songs: Song[];
  itemStarts: number[];
  selectedSong: Song | null;
  saving: boolean;
  archivedView: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onItems: (items: ProgramItemInput[]) => void;
  onPresent: (slideIndex: number) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onToggleArchived: () => void;
}) {
  const [textForm, setTextForm] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");

  const items = program?.items ?? [];

  const label = (item: ProgramRecord["items"][number]) => {
    if (item.kind === "song") {
      const snapshotted = typeof item.snapshot?.title === "string" ? item.snapshot.title : null;
      return (
        songs.find((song) => song.id === item.song_id)?.title ||
        snapshotted ||
        "(chant introuvable)"
      );
    }
    const ref = typeof item.payload?.ref === "string" ? item.payload.ref : null;
    if (item.kind === "verse") return item.title || ref || "Passage";
    if (item.kind === "media") {
      const file = typeof item.payload?.media === "string" ? item.payload.media : null;
      return item.title || (file ? file.replace(/\.[^.]+$/, "") : "Média");
    }
    return item.title || ref || "Texte";
  };

  const iconFor = (kind: string) => {
    if (kind === "song") return <Music size={14} className="shrink-0 text-primary" />;
    if (kind === "verse") return <BookOpen size={14} className="shrink-0 text-primary" />;
    if (kind === "media") return <ImageIcon size={14} className="shrink-0 text-live" />;
    if (kind === "announcement")
      return <Megaphone size={14} className="shrink-0 text-muted-foreground" />;
    return <FileText size={14} className="shrink-0 text-muted-foreground" />;
  };

  const save = (next: ProgramRecord["items"]) => onItems(next.map(toItemInput));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const moved = next.splice(index, 1)[0];
    if (!moved) return;
    next.splice(target, 0, moved);
    save(next);
  };

  const addText = () => {
    const body = textBody.trim();
    // An empty text item would project nothing at all (0 slides).
    if (!body) return;
    const title = textTitle.trim() || "Texte";
    save([
      ...items,
      {
        id: "",
        position: items.length,
        kind: "text",
        song_id: null,
        title,
        body,
        payload: null,
      },
    ]);
    setTextForm(false);
    setTextTitle("");
    setTextBody("");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Programme
        </h2>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onToggleArchived}
            title={
              archivedView
                ? "Revenir aux programmes actifs"
                : "Voir les programmes archivés (passés)"
            }
            className={`rounded border px-1.5 py-0.5 ${
              archivedView
                ? "border-primary bg-primary/20 text-primary"
                : "border-input hover:bg-muted"
            }`}
          >
            {archivedView ? "Actifs" : "Archivés"}
          </button>
          <span>{saving ? "enregistrement…" : `${items.length} élément(s)`}</span>
        </span>
      </header>

      <div className="flex items-center gap-1.5 border-b px-2 py-2">
        <select
          aria-label="Programme"
          value={program?.id ?? ""}
          onChange={(event) => onSelect(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
        >
          {programs.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
          {!program && <option value="">Aucun programme</option>}
        </select>
        {program ? (
          <IconBtn title="Nouveau programme" onClick={onCreate}>
            <Plus size={15} />
          </IconBtn>
        ) : (
          <Btn onClick={onCreate} className="shrink-0 px-2 py-1.5 text-xs">
            <Plus size={14} /> Créer un programme
          </Btn>
        )}
        <IconBtn title="Dupliquer le programme" onClick={onDuplicate} disabled={!program}>
          <Copy size={15} />
        </IconBtn>
        <IconBtn
          title={archivedView ? "Restaurer le programme" : "Archiver le programme"}
          onClick={archivedView ? onRestore : onArchive}
          disabled={!program}
        >
          {archivedView ? <ArchiveRestore size={15} /> : <Archive size={15} />}
        </IconBtn>
        <IconBtn title="Supprimer le programme" onClick={onDelete} disabled={!program}>
          <Trash2 size={15} />
        </IconBtn>
      </div>

      {program && (
        <div className="border-b px-2 py-2">
          <input
            key={`${program.id}-name`}
            defaultValue={program.name}
            aria-label="Nom du programme"
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== program.name) onRename(name);
            }}
            className={`${inputClass} font-semibold`}
          />
        </div>
      )}

      <ul className="min-h-[64px] flex-1 overflow-y-auto p-1.5">
        {items.map((item, index) => (
          <li
            key={item.id || `${item.kind}-${index}`}
            className="group flex items-center gap-1 rounded-md border border-transparent px-1 py-1 hover:border-input hover:bg-muted/60"
          >
            <button
              type="button"
              onClick={() => onPresent(itemStarts[index] ?? 0)}
              title="Présenter à partir de cet élément"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                {index + 1}
              </span>
              {iconFor(item.kind)}
              <span className="truncate text-sm">{label(item)}</span>
            </button>
            <span className="flex shrink-0 items-center">
              <IconBtn title="Monter" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp size={13} />
              </IconBtn>
              <IconBtn
                title="Descendre"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
              >
                <ArrowDown size={13} />
              </IconBtn>
              <IconBtn
                title="Retirer"
                onClick={() => save(items.filter((_, position) => position !== index))}
              >
                <X size={13} />
              </IconBtn>
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="m-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            {program
              ? "Programme vide : ajoutez le chant sélectionné, un passage ou un texte."
              : archivedView
                ? "Aucun programme archivé."
                : "Aucun programme actif. Créez-en un pour préparer le culte."}
          </li>
        )}
      </ul>

      <div className="border-t p-2">
        {textForm ? (
          <div className="space-y-2">
            <Field label="Titre">
              <input
                className={inputClass}
                value={textTitle}
                autoFocus
                onChange={(event) => setTextTitle(event.target.value)}
              />
            </Field>
            <Field
              label="Texte"
              hint="Projeté tel quel : un texte vide ne produit aucune diapositive."
            >
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={textBody}
                onChange={(event) => setTextBody(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Btn
                onClick={addText}
                disabled={textBody.trim() === ""}
                className="flex-1 justify-center"
              >
                Ajouter
              </Btn>
              <Btn variant="outline" onClick={() => setTextForm(false)}>
                Annuler
              </Btn>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Btn
              variant="outline"
              className="flex-1 justify-center"
              disabled={!program || !selectedSong}
              title={selectedSong ? `Ajouter « ${selectedSong.title} »` : "Sélectionnez un chant"}
              onClick={() => {
                if (!program || !selectedSong) return;
                save([
                  ...items,
                  {
                    id: "",
                    position: items.length,
                    kind: "song",
                    song_id: selectedSong.id,
                    title: null,
                    body: null,
                    payload: null,
                  },
                ]);
              }}
            >
              <Plus size={14} /> Chant
            </Btn>
            <Btn
              variant="outline"
              className="flex-1 justify-center"
              disabled={!program}
              onClick={() => setTextForm(true)}
            >
              <Plus size={14} /> Texte
            </Btn>
          </div>
        )}
      </div>
    </section>
  );
}
