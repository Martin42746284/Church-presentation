import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Play,
  X,
} from "lucide-react";
import { Badge, Btn, inputClass } from "@app/components/ui";
import { SlideSurface } from "@app/components/SlideSurface";
import { useSettings, updateSettings } from "@app/settings-store";
import { describeKey, THEME_LABELS } from "@app/theme";
import { THEME_PRESETS, type ThemePreset } from "@shared/settings";
import type { ProjectionSlide } from "@app/program-slides";
import type { Live } from "@/lib/store";

/**
 * Right column (bottom): what is on the projector now, what comes next and
 * the transport controls. The projection window receives its state over IPC;
 * the theme and the announcement come from the shared settings (phase 7).
 */
export function PreviewPanel({
  live,
  projectionOpen,
  fullscreen,
  online,
  onPrev,
  onNext,
  onToggleLyrics,
  onToggleProjection,
  onToggleFullscreen,
}: {
  live: Live;
  projectionOpen: boolean;
  fullscreen: boolean;
  online: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleLyrics: () => void;
  onToggleProjection: () => void;
  onToggleFullscreen: () => void;
}) {
  const settings = useSettings();
  const keys = settings.shortcuts;
  const announcement = settings.announcement;

  const current = live.slides[live.index] as ProjectionSlide | undefined;
  const last = live.index >= live.slides.length - 1;

  return (
    <section className="flex min-h-[250px] flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aperçu
        </h2>
        <span className="flex items-center gap-2">
          <select
            aria-label="Thème de projection"
            value={settings.theme.preset}
            onChange={(event) =>
              updateSettings({ theme: { preset: event.target.value as ThemePreset } })
            }
            className="rounded-md border border-input bg-background px-1.5 py-1 text-xs outline-none"
          >
            {THEME_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {THEME_LABELS[preset]}
              </option>
            ))}
          </select>
          <Badge ok={online}>{online ? "EN LIGNE" : "HORS LIGNE"}</Badge>
          <Badge ok={live.slides.length > 0}>
            {live.slides.length > 0 ? `${live.index + 1} / ${live.slides.length}` : "VIDE"}
          </Badge>
        </span>
      </header>

      <div className="min-h-0 flex-1 p-0.5">
        <div className="flex h-full min-w-0 items-center gap-2">
          <SlideSurface
            slide={current}
            blank={live.blank}
            showLyrics={live.lyricsVisible !== false}
            className="aspect-video h-full min-w-0 max-h-full max-w-full flex-none rounded border-2 border-live"
          />
          <div className="flex shrink-0 flex-col gap-2">
            <Btn
              variant="outline"
              onClick={onToggleLyrics}
              title="Afficher ou masquer les paroles (Ctrl+W)"
              className="h-9 w-9 justify-center p-0"
            >
              {live.lyricsVisible === false ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="sr-only">
                {live.lyricsVisible === false ? "Afficher les paroles" : "Masquer les paroles"}
              </span>
            </Btn>
            <Btn
              variant="outline"
              onClick={onPrev}
              disabled={live.index <= 0}
              title={`Diapositive précédente (${describeKey(keys.prev)})`}
              className="h-9 w-9 justify-center p-0"
            >
              <ChevronLeft size={16} />
              <span className="sr-only">Diapositive précédente</span>
            </Btn>
            <Btn
              variant="outline"
              onClick={onNext}
              disabled={last}
              title={`Diapositive suivante (${describeKey(keys.next)})`}
              className="h-9 w-9 justify-center p-0"
            >
              <ChevronRight size={16} />
              <span className="sr-only">Diapositive suivante</span>
            </Btn>
            <Btn
              variant={projectionOpen ? "outline" : "default"}
              onClick={onToggleProjection}
              title={projectionOpen ? "Fermer la projection" : "Démarrer le diaporama (F5)"}
              className="h-9 w-9 justify-center p-0"
            >
              {projectionOpen ? <X size={16} /> : <Play size={16} />}
              <span className="sr-only">
                {projectionOpen ? "Fermer la projection" : "Démarrer le diaporama"}
              </span>
            </Btn>
            <Btn
              variant="outline"
              onClick={onToggleFullscreen}
              disabled={!projectionOpen}
              title="Plein écran de la projection"
              className="h-9 w-9 justify-center p-0"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="sr-only">Plein écran de la projection</span>
            </Btn>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-2">
        <input
          className={`${inputClass} min-w-0 flex-1`}
          placeholder="Annonce à afficher (répétition, collecte…)"
          aria-label="Texte de l'annonce"
          value={announcement.text}
          onChange={(event) => updateSettings({ announcement: { text: event.target.value } })}
        />
        <Btn
          variant={announcement.visible ? "live" : "outline"}
          title={`Afficher ou masquer l'annonce (${describeKey(keys.announce)})`}
          onClick={() => updateSettings({ announcement: { visible: !announcement.visible } })}
        >
          {announcement.visible ? <EyeOff size={14} /> : <Eye size={14} />}
          {announcement.visible ? "Masquer" : "Afficher"}
        </Btn>
      </div>

      {live.slides.length === 0 && (
        <p className="px-3 pb-2 text-[11px] text-destructive">
          Aucune diapositive : le programme est vide ou un de ses éléments ne contient pas de texte.
        </p>
      )}

      <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        Raccourcis : Ctrl+W paroles · {describeKey(keys.next)} {describeKey(keys.prev)} naviguer ·{" "}
        {describeKey(keys.black)} écran noir · {describeKey(keys.white)} écran blanc ·{" "}
        {describeKey(keys.restore)} rétablir · {describeKey(keys.announce)} annonce
      </p>
    </section>
  );
}
