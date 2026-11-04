import { useEffect, useState } from "react";
import { ConsolePage } from "@app/pages/ConsolePage";
import { ProjectionPage } from "@app/pages/ProjectionPage";
import { setApiBase } from "@app/api";
import { church } from "@app/church-api";
import { startSettingsSync } from "@app/settings-store";
import { WorkspacePage } from "@app/workspace/WorkspacePage";

/**
 * One build serves every window: Electron loads `index.html?window=projection`
 * for the public screen, the plain URL opens the workspace (the console is one
 * click away from it).
 */
export function App() {
  // Every window follows the settings Electron main owns (phase 7) and knows
  // where the local API lives — the projection window serves media from it.
  useEffect(() => {
    startSettingsSync();
    void church
      ?.backendStatus()
      .then((status) => setApiBase(status.url))
      .catch(() => undefined);
  }, []);

  const windowParam = new URLSearchParams(window.location.search).get("window");
  const [view, setView] = useState<"workspace" | "console">("workspace");

  if (windowParam === "projection") return <ProjectionPage />;
  if (view === "console") return <ConsolePage onOpenWorkspace={() => setView("workspace")} />;
  return <WorkspacePage onOpenConsole={() => setView("console")} />;
}
