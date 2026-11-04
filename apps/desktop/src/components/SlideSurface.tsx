import { useEffect, useRef, useState } from "react";
import { SlideView } from "@/components/SlideView";
import { mediaUrl } from "@app/api";
import { isDesktop } from "@app/church-api";
import { useApiBase } from "@app/hooks";
import { useSettings } from "@app/settings-store";
import { slideTheme } from "@app/theme";
import type { ProjectionSlide } from "@app/program-slides";
import type { AppSettings } from "@shared/settings";
import type { Blank } from "@shared/ipc";

/**
 * One projected slide, themed and with the live announcement on top (phase 7).
 *
 * The shared `SlideView` keeps rendering lyrics: this wrapper only supplies
 * the `--slide-*` variables (theme, readability), swaps in the media stage for
 * `media` slides and overlays the announcement banner. Nothing in the web app
 * (`src/`) is touched.
 */
export function SlideSurface({
  slide,
  blank = "none",
  showLyrics = true,
  className = "",
  settings,
}: {
  slide?: ProjectionSlide | undefined;
  blank?: Blank;
  showLyrics?: boolean;
  className?: string;
  /** Overrides the store (tests, previews of a not-yet-applied theme). */
  settings?: AppSettings;
}) {
  const stored = useSettings();
  const active = settings ?? stored;
  // Re-renders as soon as the backend URL is known: the theme background and
  // the media files are served by it.
  useApiBase();
  const media = blank === "none" ? slide?.media : undefined;
  const announcement = active.announcement;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={slideTheme(active)}
      data-testid="slide-surface"
    >
      {media ? (
        <MediaStage media={media} />
      ) : (
        <SlideView slide={slide} blank={blank} showLyrics={showLyrics} className="h-full w-full" />
      )}

      {announcement.visible && announcement.text !== "" && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 px-6 py-3 text-center font-display font-semibold text-white"
          style={{
            fontSize: "calc(38px * var(--slide-font-scale, 1))",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {announcement.text}
        </div>
      )}
    </div>
  );
}

/** A media file painted on the same 1920×1080 stage as the lyrics. */
function MediaStage({ media }: { media: NonNullable<ProjectionSlide["media"]> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useApiBase();
  // In the desktop the URL starts empty until the backend reports its
  // ephemeral port: wait for it rather than flashing a broken picture.
  const ready = !isDesktop || apiBase !== "";
  const src = mediaUrl(media.name);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () =>
      setScale(Math.min(element.clientWidth / 1920, element.clientHeight / 1080));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const failed = () => setError(`Média introuvable : ${media.name}`);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" data-media={media.name}>
      {error ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/85 p-8 text-center text-white">
          <p className="text-3xl font-semibold">{error}</p>
          <p className="text-xl opacity-75">
            Le fichier a peut-être été supprimé de la bibliothèque de médias.
          </p>
        </div>
      ) : (
        <div className="slide-stage" style={{ transform: `scale(${scale})` }}>
          {ready &&
            (media.kind === "video" ? (
              <video
                src={src}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                onError={failed}
              />
            ) : (
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={failed}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/** Renders children only when a value exists — keeps call sites tidy. */
