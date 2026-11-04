import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { seedDefaultMedia } from "./backend";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("seedDefaultMedia", () => {
  it("copies default images once and preserves existing media", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "church-default-media-"));
    temporaryDirectories.push(root);
    const source = path.join(root, "defaults");
    const media = path.join(root, "media");
    const marker = path.join(root, "data", ".default-media-imported");
    mkdirSync(source);
    mkdirSync(media);
    writeFileSync(path.join(source, "Fond.jpg"), "default");
    writeFileSync(path.join(source, "Croix.png"), "image");
    writeFileSync(path.join(media, "Fond.jpg"), "user version");

    seedDefaultMedia(source, media, marker);

    expect(readFileSync(path.join(media, "Fond.jpg"), "utf8")).toBe("user version");
    expect(readFileSync(path.join(media, "Croix.png"), "utf8")).toBe("image");
    expect(() => seedDefaultMedia(path.join(root, "missing"), media, marker)).not.toThrow();
  });

  it("reports a missing bundled image directory", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "church-default-media-"));
    temporaryDirectories.push(root);

    expect(() =>
      seedDefaultMedia(
        path.join(root, "missing"),
        path.join(root, "media"),
        path.join(root, "marker"),
      ),
    ).toThrow("Dossier des images par défaut introuvable");
  });
});
