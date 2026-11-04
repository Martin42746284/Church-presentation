import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { SlideView } from "@/components/SlideView";

export const Route = createFileRoute("/projection")({
  head: () => ({
    meta: [
      { title: "Projection — Church Presentation" },
      { name: "description", content: "Écran de projection pour l'assemblée." },
      { property: "og:title", content: "Écran de projection" },
      { property: "og:description", content: "Affichage public du culte." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Projection,
});

function Projection() {
  const live = useStore((s) => s.live);
  return (
    <div className="h-screen w-screen cursor-none" onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      <SlideView slide={live.slides[live.index]} blank={live.blank} className="h-full w-full" />
    </div>
  );
}
