import { Film, Image as ImageIcon } from "lucide-react";
import type { Slide } from "@/lib/slides";
import { Badge } from "@app/components/ui";
import type { ProjectionSlide } from "@app/program-slides";

export function SlideQueuePanel({
  slides,
  index,
  onSelect,
}: {
  slides: Slide[];
  index: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Diapositives
        </h2>
        <Badge ok={slides.length > 0}>
          {slides.length > 0 ? `${index + 1} / ${slides.length}` : "VIDE"}
        </Badge>
      </header>

      <ol aria-label="Diapositives du programme" className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {slides.map((slide, slideIndex) => {
          const media = (slide as ProjectionSlide).media;

          return (
            <li key={`${slide.source}-${slide.label}-${slideIndex}`}>
              <button
                type="button"
                aria-current={slideIndex === index ? "step" : undefined}
                onClick={() => onSelect(slideIndex)}
                className={`mb-1 w-full rounded-md border px-2 py-1.5 text-left ${
                  slideIndex === index
                    ? "border-primary bg-primary/15"
                    : "border-transparent hover:border-input hover:bg-muted/60"
                }`}
              >
                <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold text-primary">
                    {slide.source} · {slide.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{slideIndex + 1}</span>
                </span>
                <span className="block whitespace-pre-line text-[11px] leading-snug text-foreground">
                  {media ? (
                    <span className="inline-flex items-center gap-1 text-live">
                      {media.kind === "video" ? <Film size={12} /> : <ImageIcon size={12} />}
                      {media.name}
                    </span>
                  ) : (
                    slide.text
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {slides.length === 0 && (
          <li className="m-1 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Le programme ne contient aucune diapositive.
          </li>
        )}
      </ol>
    </section>
  );
}
