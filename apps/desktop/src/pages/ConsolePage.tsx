import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorOff,
  Play,
  Power,
  RefreshCw,
} from "lucide-react";
import { AppAppearanceToggle } from "@app/components/AppAppearanceToggle";
import { goLive, setIndex, toggleLiveLyrics, useStore } from "@/lib/store";
import { toSlides } from "@/lib/slides";
import { church, isDesktop } from "@app/church-api";
import { api, type MediaRecord } from "@app/api";
import { Badge, Btn, Card, Field, inputClass, labelClass } from "@app/components/ui";
import { SlideSurface } from "@app/components/SlideSurface";
import { setCapturing } from "@app/key-capture";
import { updateSettings, useSettings } from "@app/settings-store";
import { describeKey, THEME_LABELS } from "@app/theme";
import type { ProjectionSlide } from "@app/program-slides";
import {
  useBackendStatus,
  useDisplays,
  usePaths,
  useProjection,
  useProjectionBridge,
  useProjectionEvents,
} from "@app/hooks";
import { THEME_PRESETS, type Shortcuts, type ThemePreset } from "@shared/settings";
import type { BackendStatus, DisplayInfo, ProjectionEvent } from "@shared/ipc";

/* ------------------------------------------------------------------ cards */

function BackendCard({ status, refresh }: { status: BackendStatus | null; refresh: () => void }) {
  const [busy, setBusy] = useState(false);

  const restart = async () => {
    setBusy(true);
    try {
      await church?.restartBackend();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Card
      title="Backend local"
      action={
        <span className="flex items-center gap-2">
          <Badge ok={Boolean(status?.healthy)}>
            {status?.state === "starting"
              ? "DÉMARRAGE"
              : status?.healthy
                ? "EN LIGNE"
                : "HORS LIGNE"}
          </Badge>
          <button
            type="button"
            title="Recontacter le serveur"
            onClick={refresh}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
          </button>
        </span>
      }
    >
      <dl className="space-y-1 text-sm">
        <Row label="Version">{status?.version ?? "—"}</Row>
        <Row label="PHP">{status?.php ?? "—"}</Row>
        <Row label="Migrations">{status?.migrations ?? "—"}</Row>
        <Row label="URL">{status?.url ?? "—"}</Row>
        <Row label="Base" wrap>
          {status?.database ?? "—"}
        </Row>
      </dl>
      {status?.error && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-destructive/15 p-2 text-xs text-destructive">
          {status.error}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <Btn variant="outline" onClick={restart} disabled={busy}>
          <Power size={14} /> Redémarrer
        </Btn>
      </div>
    </Card>
  );
}

function Row({ label, children, wrap }: { label: string; children: ReactNode; wrap?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`${wrap ? "break-all" : ""} text-foreground`}>{children}</dd>
    </div>
  );
}

function DisplaysCard({
  displays,
  select,
  event,
  clearEvent,
  rememberedId,
}: {
  displays: DisplayInfo[];
  select: (id: number) => void;
  event: ProjectionEvent | null;
  clearEvent: () => void;
  rememberedId: number | null;
}) {
  const selected = displays.find((display) => display.selected);
  const lost = event?.type === "display-lost";
  // After unplug the target is no longer in the list: re-selecting needs the
  // id remembered before the loss (display ids are stable across replug).
  const reactivationId = selected?.id ?? rememberedId;

  return (
    <Card
      title="Écran de projection"
      action={
        <span className="flex items-center gap-2">
          {selected ? (
            <Monitor size={14} className="text-primary" />
          ) : (
            <MonitorOff size={14} className="text-destructive" />
          )}
          <span className="text-xs text-muted-foreground">{displays.length} détecté(s)</span>
        </span>
      }
    >
      {displays.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isDesktop
            ? "Aucun écran détecté."
            : "Sélection d'écran disponible dans la version desktop."}
        </p>
      ) : (
        <ul className="space-y-1">
          {displays.map((display) => (
            <li key={display.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                  display.selected ? "border-primary bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="display"
                  checked={display.selected}
                  onChange={() => select(display.id)}
                />
                <span className="flex-1">{display.label}</span>
                {display.primary && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    principal
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {display.width}×{display.height}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {lost && (
        <div className="mt-3 rounded-md border border-destructive bg-destructive/15 p-3 text-sm">
          <p className="font-semibold">Écran de projection introuvable.</p>
          <p className="mt-1 text-muted-foreground">
            Branchez l'écran puis réactivez la projection sur cet écran.
          </p>
          <div className="mt-2">
            <Btn
              variant="outline"
              disabled={reactivationId === null}
              onClick={() => {
                if (reactivationId === null) return;
                select(reactivationId);
                clearEvent();
              }}
            >
              Réactiver la projection
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProjectionCard() {
  const projection = useProjection();

  return (
    <Card title="Fenêtre de projection">
      <div className="flex flex-wrap gap-2">
        <Btn
          onClick={() => void projection.toggle()}
          variant={projection.open ? "outline" : "default"}
        >
          {projection.open ? <Circle size={14} /> : <Play size={14} />}
          {projection.open ? "Fermer" : "Ouvrir"}
        </Btn>
        <Btn
          variant="outline"
          disabled={!projection.open}
          onClick={() => void projection.toggleFullscreen()}
        >
          {projection.fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} Plein écran
        </Btn>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        La fenêtre s'ouvre en plein écran sur l'écran sélectionné. Aucun contrôle n'y est affiché.
      </p>
    </Card>
  );
}

function LiveCard() {
  const live = useStore((state) => state.live);
  const maxLines = useStore((state) => state.maxLines);
  const songs = useStore((state) => state.songs);

  const loadDemo = () => {
    const slides = songs.flatMap((song) => toSlides(song.lyrics, song.title, maxLines));
    goLive(slides, 0);
  };

  const current = live.slides[live.index];
  const next = live.slides[live.index + 1];

  return (
    <Card
      title="LIVE"
      action={
        <span className="flex items-center gap-2">
          <Badge ok={live.slides.length > 0}>
            {live.slides.length > 0 ? `${live.index + 1} / ${live.slides.length}` : "VIDE"}
          </Badge>
          <Btn variant="outline" onClick={loadDemo}>
            <Play size={14} /> Charger les chants
          </Btn>
        </span>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-bold text-live">À l'écran</p>
          <SlideSurface
            slide={current as ProjectionSlide | undefined}
            blank={live.blank}
            showLyrics={live.lyricsVisible !== false}
            className="aspect-video rounded-lg border-2 border-live"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Suivant</p>
          <SlideSurface
            slide={next as ProjectionSlide | undefined}
            className="aspect-video rounded border"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn variant="outline" onClick={() => setIndex(live.index - 1)} disabled={live.index <= 0}>
          <ChevronLeft size={14} /> Précédent
        </Btn>
        <Btn
          variant="outline"
          onClick={() => setIndex(live.index + 1)}
          disabled={live.index >= live.slides.length - 1}
        >
          Suivant <ChevronRight size={14} />
        </Btn>
        <Btn variant="outline" onClick={toggleLiveLyrics}>
          {live.lyricsVisible === false ? <Eye size={14} /> : <EyeOff size={14} />}
          {live.lyricsVisible === false ? "Afficher paroles (Ctrl+W)" : "Masquer paroles (Ctrl+W)"}
        </Btn>
      </div>

      <ol className="mt-3 max-h-[38vh] space-y-1 overflow-auto pr-1">
        {live.slides.map((slide, index) => (
          <li key={`${slide.label}-${index}`}>
            <button
              type="button"
              onClick={() => setIndex(index)}
              className={`w-full rounded-md border p-2 text-left text-sm ${
                index === live.index ? "border-live bg-secondary" : "hover:bg-muted"
              }`}
            >
              <div className="text-xs text-primary">
                {slide.source} · {slide.label}
              </div>
              <div className="whitespace-pre-line text-muted-foreground">{slide.text}</div>
            </button>
          </li>
        ))}
        {live.slides.length === 0 && (
          <li className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Rien en direct. Chargez les chants pour démarrer.
          </li>
        )}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------- projection settings */

/**
 * Captures one key: click, then press. Runs in the capture phase so the
 * workspace transport shortcuts never fire while a binding is being recorded.
 */
function KeyCapture({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setCapturing(armed);

    if (!armed) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setArmed(false);
      if (event.key !== "Tab") onChange(event.key);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      setCapturing(false);
    };
  }, [armed, onChange]);

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title="Cliquez puis appuyez sur la touche souhaitée"
      className={`rounded-md border px-2 py-1.5 text-center font-mono text-sm ${
        armed ? "border-live bg-live/15 text-live" : "border-input bg-background hover:bg-muted"
      }`}
    >
      {armed ? "Touche…" : describeKey(value)}
    </button>
  );
}

const SHORTCUT_LABELS: Record<keyof Shortcuts, string> = {
  next: "Diapo suivante",
  prev: "Diapo précédente",
  black: "Écran noir",
  white: "Écran blanc",
  restore: "Rétablir",
  announce: "Annonce",
};

/** Theme, background picture, readability, announcement and shortcuts. */
function SettingsCard() {
  const settings = useSettings();
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const theme = settings.theme;
  const announcement = settings.announcement;

  useEffect(() => {
    void api
      .listMedia()
      .then(setMedia)
      .catch(() => setMedia([]));
  }, []);

  const images = media.filter((entry) => entry.kind === "image");

  return (
    <Card
      title="Réglages de projection"
      action={
        <span className="text-[11px] text-muted-foreground">
          {isDesktop ? "appliqués partout" : "cette fenêtre"}
        </span>
      }
    >
      <div className="space-y-3">
        <Field label="Thème">
          <select
            aria-label="Thème"
            value={theme.preset}
            onChange={(event) =>
              updateSettings({ theme: { preset: event.target.value as ThemePreset } })
            }
            className={inputClass}
          >
            {THEME_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {THEME_LABELS[preset]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Image de fond"
          hint="Superposée au dégradé du thème, à partir de la bibliothèque de médias."
        >
          <select
            aria-label="Image de fond"
            value={theme.background ?? ""}
            onChange={(event) =>
              updateSettings({ theme: { background: event.target.value || null } })
            }
            className={inputClass}
          >
            <option value="">Aucune (dégradé du thème)</option>
            {images.map((record) => (
              <option key={record.name} value={record.name}>
                {record.name}
              </option>
            ))}
            {images.length === 0 && (
              <option disabled value="">
                Aucune image importée
              </option>
            )}
          </select>
        </Field>

        <Field label={`Taille du texte — ×${theme.fontScale.toFixed(2)}`}>
          <input
            type="range"
            min={0.7}
            max={1.4}
            step={0.05}
            value={theme.fontScale}
            aria-label="Taille du texte"
            onChange={(event) =>
              updateSettings({ theme: { fontScale: Number(event.target.value) } })
            }
            className="w-full"
          />
        </Field>

        <div className="flex flex-wrap items-end gap-4">
          <fieldset>
            <legend className={labelClass}>Alignement</legend>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="align"
                  checked={theme.align === "center"}
                  onChange={() => updateSettings({ theme: { align: "center" } })}
                />
                Centré
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="align"
                  checked={theme.align === "left"}
                  onChange={() => updateSettings({ theme: { align: "left" } })}
                />
                Gauche
              </label>
            </div>
          </fieldset>

          <label className="flex items-center gap-1.5 pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={theme.shadow}
              onChange={(event) => updateSettings({ theme: { shadow: event.target.checked } })}
            />
            Ombre portée
          </label>
        </div>

        <Field label="Annonce à l'écran" hint="Bannière affichée sous la diapositive en direct.">
          <div className="flex gap-2">
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={announcement.text}
              placeholder="Répétition jeudi 19 h"
              onChange={(event) => updateSettings({ announcement: { text: event.target.value } })}
            />
            <Btn
              variant={announcement.visible ? "live" : "outline"}
              onClick={() => updateSettings({ announcement: { visible: !announcement.visible } })}
            >
              {announcement.visible ? <EyeOff size={14} /> : <Eye size={14} />}
              {announcement.visible ? "Masquer" : "Afficher"}
            </Btn>
          </div>
        </Field>

        <div>
          <span className={labelClass}>Raccourcis clavier</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHORTCUT_LABELS) as (keyof Shortcuts)[]).map((action) => (
              <label key={action} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{SHORTCUT_LABELS[action]}</span>
                <KeyCapture
                  value={settings.shortcuts[action]}
                  onChange={(key) => updateSettings({ shortcuts: { [action]: key } })}
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Les touches du pavé directionnel, une lettre ou Échap.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

function PathsFooter() {
  const paths = usePaths();
  if (!paths) return null;
  return (
    <footer className="text-xs text-muted-foreground">
      Données : {paths.dataDir} · Base : {paths.databaseFile}
    </footer>
  );
}

export function ConsolePage({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  const [status, refresh] = useBackendStatus();
  const [displays, select, rememberedId] = useDisplays();
  const [event, clearEvent] = useProjectionEvents();
  useProjectionBridge();

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-y-auto p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Church Presentation</h1>
          <p className="text-sm text-muted-foreground">
            Console d'administration — préparation et pilotage de la projection.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppAppearanceToggle />
          {!isDesktop && (
            <span className="rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive">
              Exécution en navigateur : commandes Electron indisponibles
            </span>
          )}
          <Btn variant="outline" onClick={onOpenWorkspace}>
            <ArrowLeft size={14} /> Espace de travail
          </Btn>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <BackendCard status={status} refresh={refresh} />
          <DisplaysCard
            displays={displays}
            select={(id) => {
              select(id);
              clearEvent();
            }}
            event={event}
            clearEvent={clearEvent}
            rememberedId={rememberedId}
          />
          <ProjectionCard />
          <SettingsCard />
        </div>
        <LiveCard />
      </div>

      <PathsFooter />
    </div>
  );
}
