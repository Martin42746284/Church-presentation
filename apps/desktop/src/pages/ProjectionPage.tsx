import { useEffect, useState } from "react";
import { SlideSurface } from "@app/components/SlideSurface";
import { useSettings } from "@app/settings-store";
import { setIndex, useStore } from "@/lib/store";
import { church } from "@app/church-api";
import type { ProjectionState } from "@shared/ipc";
import type { ProjectionSlide } from "@app/program-slides";

/**
 * Public screen: renders whatever state Electron main pushes to this window.
 * Outside Electron it falls back to the shared store (BroadcastChannel), which
 * is exactly how the web version behaves. The theme, the media slides and the
 * announcement banner come from the shared settings (phase 7).
 */
export function ProjectionPage() {
  const storeLive = useStore((s) => s.live);
  const settings = useSettings();
  const [pushed, setPushed] = useState<ProjectionState | null>(null);

  useEffect(() => {
    if (!church) return;
    let alive = true;
    const off = church.onProjectionState((state) => {
      if (alive) setPushed(state);
    });
    void church.getProjectionState().then((state) => {
      if (alive) setPushed(state);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    const matches = (binding: string, key: string) =>
      binding.length === 1 ? binding.toLowerCase() === key.toLowerCase() : binding === key;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (matches(settings.shortcuts.next, event.key)) {
        event.preventDefault();
        setIndex(storeLive.index + 1);
      } else if (matches(settings.shortcuts.prev, event.key)) {
        event.preventDefault();
        setIndex(storeLive.index - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings.shortcuts.next, settings.shortcuts.prev, storeLive.index]);

  const state: ProjectionState = church
    ? (pushed ?? { slides: [], index: 0, blank: "none", lyricsVisible: true })
    : {
        slides: storeLive.slides,
        index: storeLive.index,
        blank: storeLive.blank,
        lyricsVisible: storeLive.lyricsVisible !== false,
      };

  const slide = state.slides[state.index] as ProjectionSlide | undefined;

  return (
    <div
      className="h-screen w-full cursor-none overflow-hidden bg-black"
      title=""
      onDoubleClick={() => void church?.toggleFullscreen()}
    >
      <SlideSurface
        slide={slide}
        blank={state.blank}
        showLyrics={state.lyricsVisible}
        className="h-full w-full"
      />
    </div>
  );
}
