import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Church Presentation" },
      { name: "description", content: "Préparez vos chants et programmes, puis projetez le culte en direct." },
      { property: "og:title", content: "Church Presentation" },
      { property: "og:description", content: "Préparez et projetez vos cultes." },
    ],
  }),
  component: Index,
});

function Index() {
  const songs = useStore((s) => s.songs);
  const programs = useStore((s) => s.programs);
  const cards = [
    { to: "/chants", title: "Chants", n: `${songs.length} chant(s)` },
    { to: "/programmes", title: "Programmes", n: `${programs.length} programme(s)` },
    { to: "/live", title: "Projection LIVE", n: "Piloter l'écran" },
  ] as const;
  return (
    <div>
      <h1 className="text-4xl">Bonjour 👋</h1>
      <p className="mt-2 text-muted-foreground">Vos données restent sur cet ordinateur et fonctionnent hors connexion.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-xl border bg-card p-6 transition hover:border-primary">
            <h2 className="text-2xl">{c.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.n}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-10 text-xl">Derniers programmes</h2>
      <ul className="mt-3 space-y-2">
        {programs.slice(-5).reverse().map((p) => (
          <li key={p.id} className="rounded-lg border bg-card px-4 py-3">{p.name} <span className="text-sm text-muted-foreground">· {p.date}</span></li>
        ))}
      </ul>
    </div>
  );
}
