import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { goLive, setState, uid, useStore, type Song } from "@/lib/store";
import { toSlides } from "@/lib/slides";
import { SlideView } from "@/components/SlideView";

export const Route = createFileRoute("/chants")({
  head: () => ({
    meta: [
      { title: "Chants — Church Presentation" },
      { name: "description", content: "Bibliothèque de chants avec paroles et découpage en diapositives." },
      { property: "og:title", content: "Bibliothèque de chants" },
      { property: "og:description", content: "Créez, recherchez et projetez vos chants." },
    ],
  }),
  component: Chants,
});

const empty = (): Song => ({ id: uid(), title: "", author: "", lang: "fr", category: "", lyrics: "[Couplet 1]\n\n[Refrain]\n" });
const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";

function Chants() {
  const songs = useStore((s) => s.songs);
  const maxLines = useStore((s) => s.maxLines);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Song | null>(null);
  const [preview, setPreview] = useState(0);
  const nav = useNavigate();

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return songs.filter((s) => [s.title, s.author, s.lyrics, s.category, s.lang].join(" ").toLowerCase().includes(t));
  }, [songs, q]);
  const slides = edit ? toSlides(edit.lyrics, edit.title, maxLines) : [];

  const save = () => {
    if (!edit || !edit.title.trim()) return;
    setState((s) => ({ ...s, songs: s.songs.some((x) => x.id === edit.id) ? s.songs.map((x) => (x.id === edit.id ? edit : x)) : [...s.songs, edit] }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3">
        <div className="flex gap-2">
          <input className={input} placeholder="Rechercher titre, paroles, auteur…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground" onClick={() => { setEdit(empty()); setPreview(0); }}>+</button>
        </div>
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.id}>
              <button onClick={() => { setEdit({ ...s }); setPreview(0); }}
                className={`w-full rounded-md px-3 py-2 text-left hover:bg-muted ${edit?.id === s.id ? "bg-secondary" : ""}`}>
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.author} · {s.lang.toUpperCase()} {s.category && `· ${s.category}`}</div>
              </button>
            </li>
          ))}
          {!list.length && <li className="text-sm text-muted-foreground">Aucun chant.</li>}
        </ul>
      </aside>

      {edit ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <input className={input} placeholder="Titre" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className={input} placeholder="Auteur" value={edit.author} onChange={(e) => setEdit({ ...edit, author: e.target.value })} />
              <select className={input} value={edit.lang} onChange={(e) => setEdit({ ...edit, lang: e.target.value })}>
                <option value="fr">Français</option><option value="mg">Malagasy</option><option value="en">English</option>
              </select>
              <input className={input} placeholder="Catégorie" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            </div>
            <textarea className={`${input} h-80 font-mono`} value={edit.lyrics} onChange={(e) => setEdit({ ...edit, lyrics: e.target.value })} />
            <p className="text-xs text-muted-foreground">Écrivez les sections entre crochets : [Couplet 1], [Refrain], [Pont]. Une ligne vide coupe aussi une diapositive.</p>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={save}>Enregistrer</button>
              <button className="rounded-md border px-4 py-2 text-sm" onClick={() => { const c = { ...edit, id: uid(), title: edit.title + " (copie)" }; setState((s) => ({ ...s, songs: [...s.songs, c] })); setEdit(c); }}>Dupliquer</button>
              <button className="rounded-md bg-live px-4 py-2 text-sm font-semibold text-destructive-foreground" onClick={() => { goLive(slides); nav({ to: "/live" }); }}>Projeter</button>
              <button className="ml-auto rounded-md border border-destructive px-4 py-2 text-sm text-destructive" onClick={() => { if (confirm("Supprimer ce chant ?")) { setState((s) => ({ ...s, songs: s.songs.filter((x) => x.id !== edit.id) })); setEdit(null); } }}>Supprimer</button>
            </div>
          </div>
          <div className="space-y-3">
            <SlideView slide={slides[preview]} className="aspect-video rounded-lg border" />
            <div className="grid grid-cols-3 gap-2">
              {slides.map((sl, i) => (
                <button key={i} onClick={() => setPreview(i)} className={`rounded-md border p-2 text-left text-xs ${i === preview ? "border-primary" : ""}`}>
                  <div className="text-primary">{sl.label}</div>
                  <div className="line-clamp-2 text-muted-foreground">{sl.text}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground">Choisissez un chant ou créez-en un nouveau.</p>
      )}
    </div>
  );
}
