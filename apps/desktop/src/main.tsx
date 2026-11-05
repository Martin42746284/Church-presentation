import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@app/App";
import { resetLive } from "@/lib/store";
import "@app/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Conteneur racine introuvable.");

if (new URLSearchParams(window.location.search).get("window") !== "projection") {
  resetLive();
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
