import { useState, type ReactNode } from "react";
import { BookOpen, Image, ListMusic, Music2 } from "lucide-react";

/** Left column: switch between the program and the content libraries. */
export function LibraryPanel({
  program,
  songs,
  bible,
  media,
}: {
  program: ReactNode;
  songs: ReactNode;
  bible: ReactNode;
  media?: ReactNode;
}) {
  const [view, setView] = useState<"program" | "songs" | "bible" | "media">("program");

  const tabClass = (active: boolean) =>
    `flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 py-2 text-xs font-semibold transition-colors ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-background hover:text-foreground"
    }`;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <div
        role="tablist"
        aria-label="Contenu"
        className="flex shrink-0 gap-1 border-b bg-muted/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "program"}
          aria-controls="library-program-panel"
          className={tabClass(view === "program")}
          onClick={() => setView("program")}
        >
          <ListMusic size={14} aria-hidden="true" />
          Programme
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "songs"}
          aria-controls="library-songs-panel"
          className={tabClass(view === "songs")}
          onClick={() => setView("songs")}
        >
          <Music2 size={14} aria-hidden="true" />
          Chants
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "bible"}
          aria-controls="library-bible-panel"
          className={tabClass(view === "bible")}
          onClick={() => setView("bible")}
        >
          <BookOpen size={14} aria-hidden="true" />
          Bible
        </button>
        {media && (
          <button
            type="button"
            role="tab"
            aria-selected={view === "media"}
            aria-controls="library-media-panel"
            className={tabClass(view === "media")}
            onClick={() => setView("media")}
          >
            <Image size={14} aria-hidden="true" />
            Médias
          </button>
        )}
      </div>

      <div
        id="library-program-panel"
        role="tabpanel"
        aria-label="Programme"
        style={{ display: view === "program" ? "flex" : "none" }}
        className="min-h-0 flex-1 flex-col overflow-hidden"
      >
        {program}
      </div>
      <div
        id="library-songs-panel"
        role="tabpanel"
        aria-label="Chants"
        style={{ display: view === "songs" ? "flex" : "none" }}
        className="min-h-0 flex-1 flex-col overflow-hidden"
      >
        {songs}
      </div>
      <div
        id="library-bible-panel"
        role="tabpanel"
        aria-label="Bible"
        style={{ display: view === "bible" ? "flex" : "none" }}
        className="min-h-0 flex-1 flex-col overflow-hidden"
      >
        {bible}
      </div>
      {media && (
        <div
          id="library-media-panel"
          role="tabpanel"
          aria-label="Médias"
          style={{ display: view === "media" ? "flex" : "none" }}
          className="min-h-0 flex-1 flex-col overflow-hidden"
        >
          {media}
        </div>
      )}
    </section>
  );
}
