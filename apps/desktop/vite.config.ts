import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // base "./" so the built renderer can be loaded from file:// by Electron.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // The shared domain code lives in the web app (src/), which resolves
    // `react` from the repository root. Alias it here so console, projection
    // window and shared hooks all use the *same* React instance.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": here("../../src"),
      "@shared": here("./shared"),
      "@app": here("./src"),
      react: here("./node_modules/react"),
      "react-dom": here("./node_modules/react-dom"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Lets the renderer run in a plain browser during development.
    proxy: { "/api": "http://127.0.0.1:8123" },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
