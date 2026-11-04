import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { SlideView } from "@/components/SlideView";

type ProjectionScreen = {
  isPrimary: boolean;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
};

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
  const [targetScreen, setTargetScreen] = useState<ProjectionScreen | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState("");

  useEffect(() => {
    const screenWindow = window as Window & {
      getScreenDetails?: () => Promise<{ screens: ProjectionScreen[] }>;
    };
    if (!screenWindow.getScreenDetails) return;

    void screenWindow.getScreenDetails().then(({ screens }) => {
      setTargetScreen(screens.find((screen) => !screen.isPrimary) ?? null);
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      setFullscreenNotice(`Impossible d’accéder au deuxième écran : ${detail}`);
    });
  }, []);

  const enterFullscreen = () => {
    const element = document.documentElement as HTMLElement & {
      requestFullscreen(options?: FullscreenOptions & { screen: ProjectionScreen }): Promise<void>;
    };
    const request = targetScreen
      ? element.requestFullscreen({ screen: targetScreen })
      : element.requestFullscreen();
    void request.catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      setFullscreenNotice(`Impossible d’afficher la projection en plein écran : ${detail}`);
    });
  };

  return (
    <div className="h-screen w-screen cursor-none" onDoubleClick={enterFullscreen}>
      <SlideView slide={live.slides[live.index]} blank={live.blank} className="h-full w-full" />
      {fullscreenNotice && (
        <p role="status" className="absolute bottom-2 left-2 bg-black/80 p-2 text-sm text-white">
          {fullscreenNotice}
        </p>
      )}
    </div>
  );
}
