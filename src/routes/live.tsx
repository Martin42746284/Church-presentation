import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { setBlank, setIndex, setState, useStore } from "@/lib/store";
import { SlideView } from "@/components/SlideView";

type ScreenDetails = {
  screens: Array<{
    isPrimary: boolean;
    availLeft: number;
    availTop: number;
    availWidth: number;
    availHeight: number;
  }>;
};
type ProjectionScreen = Omit<ScreenDetails["screens"][number], "isPrimary">;

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Projection LIVE — Church Presentation" },
      { name: "description", content: "Pilotez la projection en direct au clavier." },
      { property: "og:title", content: "Projection LIVE" },
      { property: "og:description", content: "Contrôle de la projection pendant le culte." },
    ],
  }),
  component: Live,
});

function Live() {
  const live = useStore((s) => s.live);
  const maxLines = useStore((s) => s.maxLines);
  const [projectionNotice, setProjectionNotice] = useState("");
  const [projectionScreen, setProjectionScreen] = useState<ProjectionScreen | null>(null);
  const [requestingScreen, setRequestingScreen] = useState(false);

  const open = useCallback(() => {
    const screenWindow = window as Window & { getScreenDetails?: () => Promise<ScreenDetails> };
    if (!projectionScreen) {
      if (!screenWindow.getScreenDetails) {
        const projection = window.open("/projection", "projection", "popup,width=1280,height=720");
        if (!projection) {
          setProjectionNotice("La fenêtre de projection a été bloquée. Autorisez les fenêtres pop-up pour ce site.");
          return;
        }
        setProjectionNotice("Ce navigateur ne permet pas de choisir le deuxième écran. Déplacez la fenêtre de projection manuellement ou utilisez l’application de bureau.");
        return;
      }
      if (requestingScreen) return;

      setRequestingScreen(true);
      let screensPromise: Promise<ScreenDetails>;
      try {
        screensPromise = screenWindow.getScreenDetails();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setProjectionNotice(`Impossible d’accéder aux écrans : ${detail}`);
        setRequestingScreen(false);
        return;
      }

      void screensPromise.then(({ screens }) => {
        const secondary = screens.find((screen) => !screen.isPrimary);
        if (!secondary) {
          setProjectionNotice("Aucun deuxième écran n’est détecté par le navigateur.");
          return;
        }
        setProjectionScreen(secondary);
        setProjectionNotice("Autorisation obtenue. Appuyez de nouveau sur F5 ou cliquez sur « Projeter sur le deuxième écran ».");
      }).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        setProjectionNotice(`Accès aux écrans refusé : ${detail}. Autorisez la gestion des écrans dans les paramètres du navigateur, puis réessayez.`);
      }).finally(() => setRequestingScreen(false));
      return;
    }

    const projection = window.open(
      "/projection",
      "projection",
      `popup,width=${projectionScreen.availWidth},height=${projectionScreen.availHeight},left=${projectionScreen.availLeft},top=${projectionScreen.availTop}`,
    );
    if (!projection) {
      setProjectionNotice("La fenêtre de projection a été bloquée. Autorisez les fenêtres pop-up pour ce site.");
      return;
    }

    projection.moveTo(projectionScreen.availLeft, projectionScreen.availTop);
    projection.resizeTo(projectionScreen.availWidth, projectionScreen.availHeight);
    projection.focus();
    setProjectionNotice("Fenêtre de projection ouverte. Si elle reste sur cet écran, double-cliquez dessus pour demander le plein écran sur le deuxième écran.");
  }, [projectionScreen, requestingScreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      const k = e.key;
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(k)) { e.preventDefault(); setIndex(live.index + 1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(k)) { e.preventDefault(); setIndex(live.index - 1); }
      else if (k === "b" || k === "B") setBlank("black");
      else if (k === "w" || k === "W") setBlank("white");
      else if (k === "Home") setIndex(0);
      else if (k === "End") setIndex(live.slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live.index, live.slides.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "F5" || (event.target as HTMLElement).closest("input,textarea,select")) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const btn = "rounded-md border px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-live px-2 py-1 text-xs font-bold text-destructive-foreground">LIVE</span>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={open} disabled={requestingScreen}>
          {requestingScreen ? "Autorisation…" : projectionScreen ? "Projeter sur le deuxième écran" : "Ouvrir la fenêtre de projection"}
        </button>
        <button className={btn} onClick={() => setIndex(live.index - 1)}>← Précédent</button>
        <button className={btn} onClick={() => setIndex(live.index + 1)}>Suivant →</button>
        <button className={`${btn} ${live.blank === "black" ? "bg-secondary" : ""}`} onClick={() => setBlank("black")}>Écran noir (B)</button>
        <button className={`${btn} ${live.blank === "white" ? "bg-secondary" : ""}`} onClick={() => setBlank("white")}>Écran blanc (W)</button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Lignes max / diapo
          <input type="number" min={1} max={10} value={maxLines} className="w-16 rounded-md border bg-background px-2 py-1"
            onChange={(e) => setState((s) => ({ ...s, maxLines: Math.max(1, +e.target.value || 4) }))} />
        </label>
      </div>
      {projectionNotice && <p role="status" className="text-sm text-muted-foreground">{projectionNotice}</p>}

      {live.slides.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Rien en direct. Lancez un programme ou projetez un chant.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1 text-xs text-live">À l'écran</p><SlideView slide={live.slides[live.index]} blank={live.blank} className="aspect-video rounded-lg border-2 border-live" /></div>
              <div><p className="mb-1 text-xs text-muted-foreground">Suivant</p><SlideView slide={live.slides[live.index + 1]} className="aspect-video rounded-lg border" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Raccourcis : F5 projeter, ← → ou Espace pour naviguer, B noir, W blanc, Début/Fin.</p>
          </div>
          <ol className="max-h-[70vh] space-y-1 overflow-auto pr-1">
            {live.slides.map((s, i) => (
              <li key={i}>
                <button onClick={() => setIndex(i)} className={`w-full rounded-md border p-2 text-left text-sm ${i === live.index ? "border-live bg-secondary" : "hover:bg-muted"}`}>
                  <div className="text-xs text-primary">{s.source} · {s.label}</div>
                  <div className="whitespace-pre-line text-muted-foreground">{s.text}</div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
