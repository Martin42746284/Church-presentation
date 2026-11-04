import { useEffect, useRef, useState } from "react";
import type { Slide } from "@/lib/slides";

export function fitSlideText(
  availableHeight: number,
  measureHeight: (scale: number) => number,
): number {
  if (availableHeight <= 0 || measureHeight(1) <= availableHeight) return 1;

  let low = 0.1;
  let high = 1;
  if (measureHeight(low) > availableHeight) return low;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const midpoint = (low + high) / 2;
    if (measureHeight(midpoint) <= availableHeight) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return low;
}

/** Renders a 1920x1080 slide scaled to fit its container. */
export function SlideView({
  slide,
  blank = "none",
  showLyrics = true,
  className = "",
}: {
  slide?: Slide | undefined;
  blank?: "none" | "black" | "white";
  showLyrics?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLParagraphElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const lyrics = lyricsRef.current;
    if (!stage || !lyrics) return;

    const fit = () => {
      const availableHeight = stage.clientHeight - 340;
      const scale = fitSlideText(availableHeight, (value) => {
        lyrics.style.setProperty("--slide-content-fit", String(value));
        return lyrics.scrollHeight;
      });
      lyrics.style.setProperty("--slide-content-fit", String(scale));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(lyrics);
    return () => observer.disconnect();
  }, [slide?.text, showLyrics]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <div
        ref={stageRef}
        className="slide-stage"
        style={{ transform: `scale(${scale})` }}
        data-blank={blank}
      >
        {blank === "none" && slide && (
          <>
            {showLyrics && (
              <p ref={lyricsRef} className="slide-lyrics">
                {slide.text}
              </p>
            )}
            <span className="slide-source">{slide.source}</span>
          </>
        )}
      </div>
    </div>
  );
}
