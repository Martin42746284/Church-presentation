import { Moon, Sun } from "lucide-react";
import { updateSettings, useSettings } from "@app/settings-store";

export function AppAppearanceToggle() {
  const { appearance } = useSettings();
  const nextAppearance = appearance === "dark" ? "light" : "dark";
  const label = nextAppearance === "light" ? "Mode clair" : "Mode sombre";

  return (
    <button
      type="button"
      aria-label={`Activer le ${label.toLowerCase()}`}
      title={`Activer le ${label.toLowerCase()}`}
      onClick={() => updateSettings({ appearance: nextAppearance })}
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
    >
      {nextAppearance === "light" ? <Sun size={15} /> : <Moon size={15} />}
      <span>{label}</span>
    </button>
  );
}
