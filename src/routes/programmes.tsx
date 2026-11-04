import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { goLive, programSlides, setState, uid, useStore, type Program, type ProgramItem } from "@/lib/store";

export const Route = createFileRoute("/programmes")({
  head: () => ({
    meta: [
      { title: "Programmes — Church Presentation" },
      { name: "description", content: "Composez l'ordre de vos cultes avec chants et annonces." },
      { property: "og:title", content: "Programmes de culte" },
      { property: "og:description", content: "Organisez le déroulé du culte." },
    ],
  }),
  component: Programmes,
});

const input = "rounded-md border bg-background px-3 py-2 text-sm";

function Programmes() {
  const programs = useStore((s) => s.programs);
  const songs = useStore((s) => s.songs);
  const maxLines = useStore((s) => s.maxLines);
  const [sel, setSel] = useState<string | null>(null);
  const [addSong, setAddSong] = useState("");
  const nav = useNavigate();
  const p = programs.find((x) => x.id === (sel ?? programs[0]?.id));

  const update = (fn: (p: Program) => Program) =>
    p && setState((s) => ({ ...s, programs: s.programs.map((x) => (x.id === p.id ? fn(x) : x)) }));
  const move = (i: number, d: number) => update((p) => {
    const items = [...p.items]; const j = i + d; const a = items[i], b = items[j];
    if (j < 0 || j >= items.length) return p;
    if (!a || !b) return p; items[i] = b; items[j] = a;
    return { ...p, items };
  });
  const label = (it: ProgramItem) => it.kind === "song" ? songs.find((s) => s.id === it.songId)?.title ?? "Chant supprimé" : it.title;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-2">
        <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => { const n: Program = { id: uid(), name: "Nouveau culte", date: new Date().toISOString().slice(0, 10), items: [] }; setState((s) => ({ ...s, programs: [...s.programs, n] })); setSel(n.id); }}>
          + Nouveau programme
        </button>
        {programs.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} className={`w-full rounded-md px-3 py-2 text-left hover:bg-muted ${p?.id === x.id ? "bg-secondary" : ""}`}>
            <div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.date} · {x.items.length} élément(s)</div>
          </button>
        ))}
      </aside>

      {p ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input className={`${input} flex-1 font-display text-lg`} value={p.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} />
            <input type="date" className={input} value={p.date} onChange={(e) => update((x) => ({ ...x, date: e.target.value }))} />
            <button className="rounded-md bg-live px-4 py-2 text-sm font-semibold text-destructive-foreground" onClick={() => { goLive(programSlides(p, songs, maxLines), 0, p.id); nav({ to: "/live" }); }}>Lancer en LIVE</button>
          </div>
          <ol className="space-y-2">
            {p.items.map((it, i) => (
              <li key={it.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-muted-foreground">{i + 1}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{it.kind === "song" ? "Chant" : "Annonce"}</span>
                  {it.kind === "text"
                    ? <input className={`${input} flex-1`} value={it.title} onChange={(e) => update((x) => ({ ...x, items: x.items.map((y) => y.id === it.id ? { ...it, title: e.target.value } : y) }))} />
                    : <span className="flex-1 font-medium">{label(it)}</span>}
                  <button className="px-2" onClick={() => move(i, -1)} aria-label="Monter">↑</button>
                  <button className="px-2" onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
                  <button className="px-2 text-destructive" onClick={() => update((x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id) }))} aria-label="Retirer">✕</button>
                </div>
                {it.kind === "text" && (
                  <textarea className={`${input} mt-2 h-20 w-full`} value={it.body} onChange={(e) => update((x) => ({ ...x, items: x.items.map((y) => y.id === it.id ? { ...it, body: e.target.value } : y) }))} />
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <select className={input} value={addSong} onChange={(e) => setAddSong(e.target.value)}>
              <option value="">Choisir un chant…</option>
              {songs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <button className="rounded-md border px-3 py-2 text-sm" disabled={!addSong} onClick={() => { update((x) => ({ ...x, items: [...x.items, { id: uid(), kind: "song", songId: addSong }] })); setAddSong(""); }}>+ Chant</button>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => update((x) => ({ ...x, items: [...x.items, { id: uid(), kind: "text", title: "Annonce", body: "" }] }))}>+ Annonce</button>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => { const c = { ...p, id: uid(), name: p.name + " (copie)", items: p.items.map((i) => ({ ...i, id: uid() })) }; setState((s) => ({ ...s, programs: [...s.programs, c] })); setSel(c.id); }}>Dupliquer</button>
            <button className="ml-auto rounded-md border border-destructive px-3 py-2 text-sm text-destructive" onClick={() => { if (confirm("Supprimer ce programme ?")) { setState((s) => ({ ...s, programs: s.programs.filter((x) => x.id !== p.id) })); setSel(null); } }}>Supprimer</button>
          </div>
        </section>
      ) : <p className="text-muted-foreground">Aucun programme.</p>}
    </div>
  );
}
