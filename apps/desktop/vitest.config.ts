import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // Same aliases as vite.config.ts so tests import the real modules.
  resolve: {
    alias: {
      "@": here("../../src"),
      "@shared": here("./shared"),
      "@app": here("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "shared/**/*.test.ts", "electron/**/*.test.ts"],
  },
});
