import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadBible, searchBible, verseSlides, type Bible } from "@/lib/bible";
import { goLive } from "@/lib/store";
import { SlideView } from "@/components/SlideView";

export const Route = createFileRoute("/bible")({
  head: () => ({
    meta: [
      { title: "Bible — Church Presentation" },
      { name: "description", content: "Recherchez un passage biblique et projetez-le pendant le culte." },
      { property: "og:title", content: "Bible — projection de versets" },
      { property: "og:description", content: "Recherche et projection de passages bibliques (Louis Segond 1910)." },
    ],
  }),
  component: BiblePage,
});

const input = "rounded-md border bg-background px-3 py-2 text-sm";

function BiblePage() {
  const [bible, setBible] = useState<Bible | null>(null);
  const [error, setError] = useState(false);
  const [book, setBook] = useState(42); // Jean
  const [chapter, setChapter] = useState(3);
  const [from, setFrom] = useState(16);
  const [to, setTo] = useState(16);
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    loadBible().then(setBible).catch(() => setError(true));
  }, []);

  const b = bible?.books[book];
  const chapterCount = b?.chapters.length ?? 0;
  const verseCount = b?.chapters[chapter - 1]?.length ?? 0;

  const slides = useMemo(
    () => (bible ? verseSlides(bible, book, chapter - 1, from, to) : []),
    [bible, book, chapter, from, to],
  );
  const hits = useMemo(() => (bible ? searchBible(bible, query) : []), [bible, query]);

  const project = () => {
    if (!slides.length) return;
    goLive(slides, 0);
    nav({ to: "/live" });
  };

  if (error) return <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Impossible de charger la Bible.</p>;
  if (!bible) return <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Chargement de la Bible…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className={input} value={book} onChange={(e) => { setBook(+e.target.value); setChapter(1); setFrom(1); setTo(1); }}>
            {bible.books.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
          </select>
          <select className={input} value={chapter} onChange={(e) => { setChapter(+e.target.value); setFrom(1); setTo(1); }}>
            {Array.from({ length: chapterCount }, (_, i) => <option key={i + 1} value={i + 1}>Chapitre {i + 1}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-muted-foreground">
            Verset
            <input type="number" min={1} max={verseCount} value={from} className={`${input} w-20`}
              onChange={(e) => setFrom(Math.max(1, +e.target.value || 1))} />
          </label>
          <label className="flex items-center gap-1 text-sm text-muted-foreground">
            à
            <input type="number" min={1} max={verseCount} value={to} className={`${input} w-20`}
              onChange={(e) => setTo(Math.max(1, +e.target.value || 1))} />
          </label>
          <button className="rounded-md bg-live px-4 py-2 text-sm font-semibold text-destructive-foreground" onClick={project} disabled={!slides.length}>
            Projeter ({slides.length} diapo{slides.length > 1 ? "s" : ""})
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><p className="mb-1 text-xs text-muted-foreground">Aperçu</p><SlideView slide={slides[0]} className="aspect-video rounded-lg border" /></div>
          <div><p className="mb-1 text-xs text-muted-foreground">Suivant</p><SlideView slide={slides[1]} className="aspect-video rounded-lg border" /></div>
        </div>

        <ol className="space-y-1">
          {slides.map((s, i) => (
            <li key={i} className="rounded-md border bg-card p-2 text-sm">
              <span className="text-xs font-semibold text-primary">{s.label}</span>
              <span className="ml-2 text-muted-foreground">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="space-y-2">
        <input className={`${input} w-full`} placeholder="Rechercher dans toute la Bible (3 lettres min.)…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim().length >= 3 && (
          <p className="text-xs text-muted-foreground">{hits.length}{hits.length === 50 ? "+" : ""} résultat(s)</p>
        )}
        <ol className="max-h-[70vh] space-y-1 overflow-auto pr-1">
          {hits.map((h, i) => (
            <li key={i}>
              <button className="w-full rounded-md border bg-card p-2 text-left text-sm hover:bg-muted"
                onClick={() => { setBook(h.ref.book); setChapter(h.ref.chapter + 1); setFrom(h.ref.verse); setTo(h.ref.verse); }}>
                <div className="text-xs font-semibold text-primary">{h.label}</div>
                <div className="text-muted-foreground">{h.text}</div>
              </button>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Traduction : {bible.translation} (domaine public).</p>
      </aside>
    </div>
  );
}
