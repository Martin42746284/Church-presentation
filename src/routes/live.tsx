import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { setBlank, setIndex, setState, useStore } from "@/lib/store";
import { SlideView } from "@/components/SlideView";

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

  const open = () => window.open("/projection", "projection", "popup,width=1280,height=720");
  const btn = "rounded-md border px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-live px-2 py-1 text-xs font-bold text-destructive-foreground">LIVE</span>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={open}>Ouvrir la fenêtre de projection</button>
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

      {live.slides.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Rien en direct. Lancez un programme ou projetez un chant.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1 text-xs text-live">À l'écran</p><SlideView slide={live.slides[live.index]} blank={live.blank} className="aspect-video rounded-lg border-2 border-live" /></div>
              <div><p className="mb-1 text-xs text-muted-foreground">Suivant</p><SlideView slide={live.slides[live.index + 1]} className="aspect-video rounded-lg border" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Raccourcis : ← → ou Espace pour naviguer, B noir, W blanc, Début/Fin.</p>
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
