import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Monitor, RefreshCw, Settings } from "lucide-react";
import { AppAppearanceToggle } from "@app/components/AppAppearanceToggle";
import {
  api,
  setApiBase,
  toDomainProgram,
  toDomainSong,
  toItemInput,
  type LibrarySong,
  type MediaRecord,
  type PassageSelection,
  type ProgramItemInput,
  type ProgramRecord,
} from "@app/api";
import { Badge, Btn } from "@app/components/ui";
import { isDesktop } from "@app/church-api";
import { isCapturing } from "@app/key-capture";
import { updateSettings, useSettings } from "@app/settings-store";
import {
  useBackendStatus,
  useDisplays,
  usePaths,
  useProjection,
  useProjectionBridge,
  useProjectionEvents,
} from "@app/hooks";
import { BiblePanel } from "@app/workspace/BiblePanel";
import { LibraryPanel } from "@app/workspace/LibraryPanel";
import { MediaPanel } from "@app/workspace/MediaPanel";
import { ProgramPanel } from "@app/workspace/ProgramPanel";
import { PreviewPanel } from "@app/workspace/PreviewPanel";
import { SlideQueuePanel } from "@app/workspace/SlideQueuePanel";
import { SongEditor } from "@app/workspace/SongEditor";
import { SongLibrary } from "@app/workspace/SongLibrary";
import { slidesOfItem, slidesOfPassage, type ProjectionSlide } from "@app/program-slides";
import { goLive, setBlank, setIndex, toggleLiveLyrics, useStore } from "@/lib/store";
import { toSlides } from "@/lib/slides";

type ProgramView = ReturnType<typeof toDomainProgram>;
type ProgramViewItem = ProgramView["items"][number];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const today = () => new Date().toISOString().slice(0, 10);
const sameSlides = (
  left: readonly {
    label: string;
    text: string;
    source: string;
    media?: { name: string; kind: string };
  }[],
  right: readonly {
    label: string;
    text: string;
    source: string;
    media?: { name: string; kind: string };
  }[],
) =>
  left.length === right.length &&
  left.every((slide, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      slide.label === other.label &&
      slide.text === other.text &&
      slide.source === other.source &&
      slide.media?.name === other.media?.name &&
      slide.media?.kind === other.media?.kind
    );
  });

/**
 * VideoPsalm-style workspace: song library on the left, song editor in the
 * middle, order of service and preview on the right. No account, no role —
 * the app is local and single-user by design.
 */
export function WorkspacePage({ onOpenConsole }: { onOpenConsole: () => void }) {
  const [status, refreshStatus] = useBackendStatus();
  const [displays, selectDisplay] = useDisplays();
  const [, clearProjectionEvent] = useProjectionEvents();
  const projection = useProjection();
  const paths = usePaths();
  useProjectionBridge();

  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [songId, setSongId] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  // Electron knows the ephemeral port of the PHP server; the browser relies on
  // the Vite proxy, hence the relative base URL.
  const base = isDesktop ? (status?.url ?? null) : "";

  // Set during render: child effects run *before* the parent's, so a panel
  // mounted with the API already reachable must not wait for this effect.
  if (base !== null) setApiBase(base);

  useEffect(() => {
    if (base === null) return;
    let alive = true;
    setLoadError(null);

    void (async () => {
      try {
        const [songRecords, programRecords] = await Promise.all([
          api.listSongs(),
          api.listPrograms({ archived: showArchived }),
        ]);
        if (!alive) return;
        setSongs(songRecords.map(toDomainSong));
        setPrograms(programRecords);
        setSongId((current) =>
          current && songRecords.some((entry) => entry.id === current) ? current : null,
        );
        setProgramId((current) =>
          current && programRecords.some((entry) => entry.id === current)
            ? current
            : (programRecords[0]?.id ?? null),
        );
      } catch (error) {
        if (alive) setLoadError(message(error));
      }
    })();

    return () => {
      alive = false;
    };
  }, [base, reload, showArchived]);

  const song = songs.find((entry) => entry.id === songId) ?? null;
  const program = programs.find((entry) => entry.id === programId) ?? null;

  const maxLines = useStore((state) => state.maxLines);
  const live = useStore((state) => state.live);

  const programView = useMemo(() => (program ? toDomainProgram(program) : null), [program]);
  const itemSlides = useMemo(
    () => (programView ? programView.items.map((item) => slidesOfItem(item, songs, maxLines)) : []),
    [programView, songs, maxLines],
  );
  const slides = useMemo(() => itemSlides.flat(), [itemSlides]);
  const songSlides = useMemo(() => {
    return song ? toSlides(song.lyrics, song.title, maxLines) : [];
  }, [song, maxLines]);
  const itemStarts = useMemo(() => {
    let cursor = 0;
    return itemSlides.map((list) => {
      const start = cursor;
      cursor += list.length;
      return start;
    });
  }, [itemSlides]);

  // Keep the program or song already on air in sync after edits; merely selecting
  // a song in the library must not change the public projection.
  useEffect(() => {
    if (live.source === "bible") return;
    if (song && live.songId === song.id) {
      if (!sameSlides(live.slides, songSlides)) {
        goLive(
          songSlides,
          Math.min(live.index, Math.max(0, songSlides.length - 1)),
          undefined,
          song.id,
        );
      }
      return;
    }
    if (program && live.programId === program.id && !sameSlides(live.slides, slides)) {
      goLive(slides, Math.min(live.index, Math.max(0, slides.length - 1)), program.id);
      return;
    }
    if (program && !live.programId && !live.songId && live.slides.length === 0) {
      goLive(slides, 0, program.id);
    }
  }, [program, slides, song, songSlides, live]);

  // Transport shortcuts — bindings come from the settings (phase 7) and are
  // ignored while the operator is typing.
  const settings = useSettings();
  const shortcuts = settings.shortcuts;

  useEffect(() => {
    const matches = (binding: string, key: string) =>
      binding.length === 1 ? binding.toLowerCase() === key.toLowerCase() : binding === key;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "w" && !isCapturing()) {
        event.preventDefault();
        if (!event.repeat) toggleLiveLyrics();
        return;
      }

      if (event.key === "F5" && !isCapturing()) {
        event.preventDefault();
        if (!event.repeat) void projection.start();
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || isCapturing()) return;

      if (matches(shortcuts.next, event.key)) {
        event.preventDefault();
        setIndex(live.index + 1);
      } else if (matches(shortcuts.prev, event.key)) {
        event.preventDefault();
        setIndex(live.index - 1);
      } else if (matches(shortcuts.black, event.key)) {
        setBlank("black");
      } else if (matches(shortcuts.white, event.key)) {
        setBlank("white");
      } else if (matches(shortcuts.restore, event.key)) {
        setBlank("none");
      } else if (matches(shortcuts.announce, event.key)) {
        updateSettings({ announcement: { visible: !settings.announcement.visible } });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [live.index, shortcuts, settings.announcement.visible, projection.start]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
      setNotice(null);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setSaving(false);
    }
  }, []);

  /* ------------------------------------------------------------ programs */

  const replaceProgram = (updated: ProgramRecord) =>
    setPrograms((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));

  const saveItems = (items: ProgramItemInput[]) =>
    run(async () => {
      if (!program) return;
      replaceProgram(await api.updateProgram(program.id, { items }));
    });

  const activateProgram = (id: string, records = programs) => {
    setProgramId(id);
    setSongId(null);
    const selected = records.find((entry) => entry.id === id);
    if (!selected) return;
    const view = toDomainProgram(selected);
    const selectedSlides = view.items.flatMap((item) => slidesOfItem(item, songs, maxLines));
    goLive(selectedSlides, 0, selected.id);
  };

  const renameProgram = (name: string) =>
    run(async () => {
      if (!program) return;
      replaceProgram(await api.updateProgram(program.id, { name }));
    });

  const createProgram = () =>
    run(async () => {
      const date = today();
      const created = await api.createProgram({ name: `Culte du ${date}`, date });
      const updatedPrograms = [created, ...programs];
      setPrograms(updatedPrograms);
      activateProgram(created.id, updatedPrograms);
    });

  const deleteProgram = () => {
    if (!program) return;
    if (!window.confirm(`Supprimer le programme « ${program.name} » ?`)) return;
    run(async () => {
      await api.deleteProgram(program.id);
      const remaining = programs.filter((entry) => entry.id !== program.id);
      setPrograms(remaining);
      if (programId === program.id) setProgramId(remaining[0]?.id ?? null);
    });
  };

  const duplicateProgram = () => {
    if (!program) return;
    run(async () => {
      const copy = await api.duplicateProgram(program.id);
      const updatedPrograms = [copy, ...programs];
      setPrograms(updatedPrograms);
      activateProgram(copy.id, updatedPrograms);
    });
  };

  /** Archiving keeps the past programs (and their snapshots) out of the way. */
  const archiveProgram = () => {
    if (!program) return;
    run(async () => {
      const archived = await api.archiveProgram(program.id);
      const remaining = programs.filter((entry) => entry.id !== archived.id);
      setPrograms(remaining);
      if (programId === archived.id) setProgramId(remaining[0]?.id ?? null);
    });
  };

  const restoreProgram = () => {
    if (!program) return;
    run(async () => {
      const restored = await api.restoreProgram(program.id);
      const remaining = programs.filter((entry) => entry.id !== restored.id);
      setPrograms(remaining);
      if (programId === restored.id) setProgramId(remaining[0]?.id ?? null);
    });
  };

  const addPassage = (selection: PassageSelection) => {
    if (!program) return;
    saveItems([
      ...program.items.map(toItemInput),
      {
        kind: "verse",
        title: selection.ref,
        body: selection.verses.map((verse) => verse.text).join("\n\n"),
        payload: {
          ref: selection.ref,
          book: selection.book,
          chapter: selection.chapter,
          from: selection.from,
          to: selection.to,
          translation: selection.translation,
          verses: selection.verses,
        },
      },
    ]);
  };

  const projectPassage = (selection: PassageSelection) => {
    setSongId(null);
    goLive(slidesOfPassage(selection, maxLines), 0, undefined, undefined, "bible");
  };

  const present = (index: number) => {
    if (!program) return;
    setSongId(null);
    goLive(slides, Math.max(0, Math.min(index, slides.length - 1)), program.id);
  };

  /* --------------------------------------------------------------- songs */

  const createSong = () =>
    run(async () => {
      const created = await api.createSong({
        title: "Nouveau chant",
        lang: "fr",
        lyrics: "[Couplet 1]\n",
      });
      const record = toDomainSong(created);
      setSongs((list) => [...list, record]);
      selectSong(record.id, record);
    });

  const saveSong = (draft: LibrarySong) =>
    run(async () => {
      const updated = await api.updateSong(draft.id, {
        title: draft.title,
        author: draft.author,
        lang: draft.lang,
        category: draft.category,
        collection: draft.collection,
        lyrics: draft.lyrics,
      });
      const record = toDomainSong(updated);
      setSongs((list) => list.map((entry) => (entry.id === record.id ? record : entry)));
    });

  const deleteSong = () => {
    if (!song) return;
    if (!window.confirm(`Supprimer le chant « ${song.title} » ?`)) return;
    run(async () => {
      await api.deleteSong(song.id);
      const remaining = songs.filter((entry) => entry.id !== song.id);
      setSongs(remaining);
      if (songId === song.id) setSongId(null);
    });
  };

  const addSongToProgram = () => {
    if (!program || !song) return;
    saveItems([...program.items.map(toItemInput), { kind: "song", song_id: song.id }]);
  };

  const selectSong = (id: string, selectedSong?: LibrarySong) => {
    const selected = selectedSong ?? songs.find((entry) => entry.id === id);
    if (!selected) return;
    setSongId(id);
    goLive(toSlides(selected.lyrics, selected.title, maxLines), 0, undefined, selected.id);
  };

  /** A media file becomes a `media` program item (phase 7). */
  const addMedia = (media: MediaRecord) => {
    if (!program) return;
    saveItems([
      ...program.items.map(toItemInput),
      {
        kind: "media",
        title: media.name.replace(/\.[^.]+$/, ""),
        payload: { media: media.name, kind: media.kind },
      },
    ]);
  };

  const projectMedia = (media: MediaRecord) => {
    const title = media.name.replace(/\.[^.]+$/, "");
    setSongId(null);
    const mediaSlides: ProjectionSlide[] = [
      { label: title, text: "", source: title, media: { name: media.name, kind: media.kind } },
    ];
    goLive(mediaSlides, 0);
  };

  const selectedDisplay = displays.find((display) => display.selected);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-base font-semibold">Church Presentation</h1>
          <span className="text-xs text-muted-foreground">Espace de travail</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AppAppearanceToggle />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Monitor size={14} />
            <select
              aria-label="Écran de projection"
              value={selectedDisplay ? String(selectedDisplay.id) : ""}
              disabled={displays.length === 0}
              onChange={(event) => {
                selectDisplay(Number(event.target.value));
                clearProjectionEvent();
              }}
              className="max-w-[220px] rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none disabled:opacity-60"
            >
              {displays.length === 0 && <option value="">Écran principal</option>}
              {displays.map((display) => (
                <option key={display.id} value={String(display.id)}>
                  {display.label}
                </option>
              ))}
            </select>
          </label>

          <Badge ok={Boolean(status?.healthy)}>
            {status?.state === "starting"
              ? "DÉMARRAGE"
              : status?.healthy
                ? "EN LIGNE"
                : "HORS LIGNE"}
          </Badge>
          <Btn
            variant="outline"
            title="Recontacter le serveur local"
            onClick={refreshStatus}
            className="px-2"
          >
            <RefreshCw size={14} />
          </Btn>
          <Btn variant="outline" onClick={onOpenConsole} title="Ouvrir la console d'administration">
            <Settings size={14} /> Console
          </Btn>
        </div>
      </header>

      {loadError ? (
        <div className="flex flex-wrap items-center gap-3 border-b bg-destructive/15 px-3 py-2 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            {loadError}
          </span>
          <Btn
            variant="outline"
            className="ml-auto"
            onClick={() => setReload((count) => count + 1)}
          >
            Réessayer
          </Btn>
        </div>
      ) : (
        notice && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-destructive/15 px-3 py-2 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} />
              {notice}
            </span>
            <Btn variant="outline" className="ml-auto" onClick={() => setNotice(null)}>
              Fermer
            </Btn>
          </div>
        )
      )}

      <main className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,22fr)_minmax(0,44fr)_minmax(0,34fr)] gap-3 overflow-hidden p-3">
        <LibraryPanel
          program={
            <ProgramPanel
              programs={programs}
              program={program}
              songs={songs}
              itemStarts={itemStarts}
              selectedSong={song}
              saving={saving}
              archivedView={showArchived}
              onSelect={activateProgram}
              onCreate={() => void createProgram()}
              onDelete={deleteProgram}
              onRename={renameProgram}
              onItems={saveItems}
              onPresent={present}
              onDuplicate={duplicateProgram}
              onArchive={archiveProgram}
              onRestore={restoreProgram}
              onToggleArchived={() => setShowArchived((value) => !value)}
            />
          }
          songs={
            <SongLibrary
              songs={songs}
              selectedId={songId}
              onSelect={selectSong}
              onCreate={() => void createSong()}
            />
          }
          bible={
            <BiblePanel
              ready={base !== null}
              canAdd={Boolean(program)}
              onAddPassage={addPassage}
              onProjectPassage={projectPassage}
            />
          }
          media={
            <MediaPanel
              ready={base !== null}
              canAdd={Boolean(program)}
              onAdd={addMedia}
              onProject={projectMedia}
            />
          }
        />

        <SongEditor
          key={song?.id ?? "none"}
          song={song}
          maxLines={maxLines}
          saving={saving}
          canAddToProgram={Boolean(program && song)}
          onSave={(draft) => void saveSong(draft)}
          onDelete={deleteSong}
          onAddToProgram={addSongToProgram}
          onCreate={() => void createSong()}
        />

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex min-h-0 flex-[0.8] flex-col">
            <SlideQueuePanel slides={live.slides} index={live.index} onSelect={setIndex} />
          </div>
          <PreviewPanel
            live={live}
            online={Boolean(status?.healthy)}
          />
        </div>
      </main>

      <footer className="flex flex-wrap items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{songs.length} chant(s)</span>
        <span>{programs.length} programme(s)</span>
        {status?.url && <span>{status.url}</span>}
        {paths && <span className="truncate">Données : {paths.dataDir}</span>}
        {!isDesktop && <span>Mode navigateur : commandes Electron indisponibles</span>}
        <span className="ml-auto">{saving ? "enregistrement…" : "prêt"}</span>
      </footer>
    </div>
  );
}
