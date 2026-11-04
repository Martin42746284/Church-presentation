/**
 * Bundles the Electron main process and the preload bridge to CommonJS
 * (.cjs: the preload must be CJS under sandboxing, and the package is ESM).
 */
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const outdir = path.join(root, "dist-electron");

export async function bundleElectron() {
  await rm(outdir, { recursive: true, force: true });

  await build({
    entryPoints: [
      path.join(root, "electron", "main.ts"),
      path.join(root, "electron", "preload.ts"),
    ],
    outbase: path.join(root, "electron"),
    outdir,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    sourcemap: true,
    outExtension: { ".js": ".cjs" },
    logLevel: "info",
  });
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await bundleElectron();
}
