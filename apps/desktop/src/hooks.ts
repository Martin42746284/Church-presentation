import { useCallback, useEffect, useRef, useState } from "react";
import { church } from "@app/church-api";
import { getApiBase, subscribeApiBase } from "@app/api";
import { useStore } from "@/lib/store";
import type { AppPaths, BackendStatus, DisplayInfo, ProjectionEvent } from "@shared/ipc";

/** Backend health, refreshed on demand, on every backend event and every 5 s. */
export function useBackendStatus(): [BackendStatus | null, () => void] {
  const [status, setStatus] = useState<BackendStatus | null>(null);

  const refresh = useCallback(() => {
    void church?.backendStatus().then(setStatus);
  }, []);

  useEffect(() => {
    if (!church) return;
    refresh();
    const off = church.onBackendEvent(setStatus);
    const timer = setInterval(refresh, 5000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [refresh]);

  return [status, refresh];
}

/**
 * Backend base URL of this window, kept up to date. Media URLs are built from
 * it, so a window that learns the ephemeral port late (the projection window)
 * re-renders as soon as it is known.
 */
export function useApiBase(): string {
  const [value, setValue] = useState(getApiBase);
  useEffect(() => subscribeApiBase(() => setValue(getApiBase())), []);
  return value;
}

/** Displays of the machine, plus the user's selection. */
export function useDisplays(): [DisplayInfo[], (id: number) => void, number | null] {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  // Kept up to date synchronously with every list we receive, so the target id
  // survives an unplug (the display is then absent from the list).
  const [remembered, setRemembered] = useState<number | null>(null);

  const apply = useCallback((list: DisplayInfo[]) => {
    const current = list.find((display) => display.selected);
    if (current) setRemembered(current.id);
    setDisplays(list);
  }, []);

  useEffect(() => {
    if (!church) return;
    let alive = true;
    void church.listDisplays().then((list) => {
      if (alive) apply(list);
    });
    const off = church.onDisplaysChanged(apply);
    return () => {
      alive = false;
      off();
    };
  }, [apply]);

  const select = useCallback(
    (id: number) => {
      void church?.selectDisplay(id).then(apply);
    },
    [apply],
  );

  return [displays, select, remembered];
}

export function useProjectionEvents(): [ProjectionEvent | null, () => void] {
  const [event, setEvent] = useState<ProjectionEvent | null>(null);
  useEffect(() => {
    if (!church) return;
    const off = church.onProjectionEvent(setEvent);
    return off;
  }, []);
  const clear = useCallback(() => setEvent(null), []);
  return [event, clear];
}

/** Open/fullscreen state of the projection window. */
export function useProjection(): {
  open: boolean;
  fullscreen: boolean;
  start: () => Promise<void>;
  toggle: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
} {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!church) return;
    void church.isProjectionOpen().then(setOpen);
    const off = church.onProjectionEvent((event) => {
      if (event.type === "opened") setOpen(true);
      if (event.type === "closed") {
        setOpen(false);
        setFullscreen(false);
      }
    });
    return off;
  }, []);

  const toggle = useCallback(async () => {
    if (!church) return;
    if (open) {
      await church.closeProjection();
      setOpen(false);
    } else {
      await church.openProjection();
      setOpen(true);
    }
  }, [open]);

  const start = useCallback(async () => {
    if (!church || open) return;
    await church.openProjection();
    setOpen(true);
  }, [open]);

  const toggleFullscreen = useCallback(async () => {
    if (!church) return;
    setFullscreen(await church.toggleFullscreen());
  }, []);

  return { open, fullscreen, start, toggle, toggleFullscreen };
}

/** Mirrors the LIVE state of the shared store into the projection window. */
export function useProjectionBridge(): void {
  const live = useStore((state) => state.live);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const bridge = church;
    if (!bridge) return;
    return bridge.onProjectionEvent((event) => {
      if (event.type !== "opened") return;
      const current = liveRef.current;
      void bridge.setProjectionState({
        slides: current.slides,
        index: current.index,
        blank: current.blank,
        lyricsVisible: current.lyricsVisible !== false,
      });
    });
  }, []);

  useEffect(() => {
    void church?.setProjectionState({
      slides: live.slides,
      index: live.index,
      blank: live.blank,
      lyricsVisible: live.lyricsVisible !== false,
    });
  }, [live]);
}

/** Data/backup/log folders decided at first run. */
export function usePaths(): AppPaths | null {
  const [paths, setPaths] = useState<AppPaths | null>(null);
  useEffect(() => {
    void church?.getPaths().then(setPaths);
  }, []);
  return paths;
}
