import { Eye, EyeOff } from "lucide-react";
import { Badge, Btn, inputClass } from "@app/components/ui";
import { SlideSurface } from "@app/components/SlideSurface";
import { useSettings, updateSettings } from "@app/settings-store";
import { describeKey, THEME_LABELS } from "@app/theme";
import { THEME_PRESETS, type ThemePreset } from "@shared/settings";
import type { ProjectionSlide } from "@app/program-slides";
import type { Live } from "@/lib/store";

/**
 * The projection preview and announcement controls. Projection actions remain
 * available through the keyboard shortcuts shown below.
 */
export function PreviewPanel({
  live,
  online,
}: {
  live: Live;
  online: boolean;
}) {
  const settings = useSettings();
  const keys = settings.shortcuts;
  const announcement = settings.announcement;

  const current = live.slides[live.index] as ProjectionSlide | undefined;
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
        <SlideSurface
          slide={current}
          blank={live.blank}
          showLyrics={live.lyricsVisible !== false}
          className="aspect-video h-full min-w-0 max-h-full max-w-full rounded border-2 border-live"
        />
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
