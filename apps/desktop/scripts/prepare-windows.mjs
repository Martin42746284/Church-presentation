import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const resourceRoot = path.join(appRoot, "build-resources");
const phpRoot = path.join(resourceRoot, "php");
const backendRoot = path.join(resourceRoot, "backend");
const defaultMediaRoot = path.join(resourceRoot, "default-media");
const vcRedistPath = path.join(resourceRoot, "vc_redist.x64.exe");
const sourceMediaRoot = path.join(repoRoot, "Images with names");
const phpVersion = "8.3.36";
const phpArchiveName = `php-${phpVersion}-1-nts-Win32-vs16-x64.zip`;
const phpArchiveUrl = `https://downloads.php.net/~windows/releases/archives/${phpArchiveName}`;
const phpArchiveSha256 = "1a097d52b7a68622cdc723073b61cc70caf79c941218ff65b2d8441dbc6b10d4";
const vcRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe";

async function preparePhp() {
  if (await exists(path.join(phpRoot, "php.exe"))) {
    console.log("Runtime PHP Windows déjà préparé.");
    return;
  }

  const response = await fetch(phpArchiveUrl);
  if (!response.ok || !response.body) {
    throw new Error(
      `Téléchargement de PHP impossible (${response.status} ${response.statusText}).`,
    );
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "church-presentation-php-"));
  const archive = path.join(temporaryRoot, "php.zip");
  const extracted = path.join(temporaryRoot, "extracted");

  try {
    await mkdir(extracted, { recursive: true });
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
    const checksum = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    if (checksum !== phpArchiveSha256) {
      throw new Error(`La somme SHA-256 du runtime PHP est invalide (${checksum}).`);
    }

    if (process.platform === "win32") {
      const quote = (value) => `'${value.replaceAll("'", "''")}'`;
      await execFile("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)} -Force`,
      ]);
    } else {
      await execFile("unzip", ["-q", archive, "-d", extracted]);
    }

    await cp(extracted, phpRoot, { recursive: true });
    if (!(await exists(path.join(phpRoot, "php.exe")))) {
      throw new Error("L’archive PHP téléchargée ne contient pas php.exe à sa racine.");
    }

    await writeFile(
      path.join(phpRoot, "php.ini"),
      [
        "[PHP]",
        'extension_dir="ext"',
        "extension=mbstring",
        "extension=openssl",
        "extension=fileinfo",
        "extension=pdo_sqlite",
        "extension=sqlite3",
        "date.timezone=UTC",
        "",
      ].join("\r\n"),
    );
    console.log(`Runtime PHP ${phpVersion} préparé.`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function prepareBackend() {
  await rm(backendRoot, { recursive: true, force: true });
  await mkdir(backendRoot, { recursive: true });

  await cp(path.join(repoRoot, "backend"), backendRoot, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(path.join(repoRoot, "backend"), source);
      if (!relative || relative === ".") return true;
      const parts = relative.split(path.sep);
      if ([".env", ".phpunit.result.cache", "tests", "node_modules"].includes(parts[0] ?? "")) {
        return false;
      }
      if (parts[0] === "database" && parts.at(-1)?.endsWith(".sqlite")) return false;
      if (parts[0] === "storage") return false;
      return true;
    },
  });

  const database = path.join(backendRoot, "database");
  const seeders = path.join(database, "seeders");
  await mkdir(seeders, { recursive: true });

  await cp(
    path.join(repoRoot, "public", "bible-ls1910.json"),
    path.join(database, "bible-ls1910.json"),
  );
  await cp(
    path.join(repoRoot, "public", "bible-ls1910.meta.json"),
    path.join(database, "bible-ls1910.meta.json"),
  );
  await cp(path.join(repoRoot, "Bible_MG65.json"), path.join(seeders, "Bible_MG65.json"));
  await cp(path.join(repoRoot, "Bible_MG65.meta.json"), path.join(seeders, "Bible_MG65.meta.json"));
  await cp(path.join(repoRoot, "addF_r6.json"), path.join(seeders, "addF_r6.json"));

  for (const relative of [
    "storage/app/private",
    "storage/framework/cache/data",
    "storage/framework/sessions",
    "storage/framework/views",
    "storage/logs",
  ]) {
    await mkdir(path.join(backendRoot, relative), { recursive: true });
  }

  await writeFile(
    path.join(backendRoot, "storage", "framework", "views", ".gitignore"),
    "*\n!.gitignore\n",
  );
}

async function prepareVcRedist() {
  if (!(await exists(vcRedistPath))) {
    const response = await fetch(vcRedistUrl);
    if (!response.ok || !response.body) {
      throw new Error(
        `Téléchargement du runtime Visual C++ impossible (${response.status} ${response.statusText}).`,
      );
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(vcRedistPath));
  }

  const file = await readFile(vcRedistPath);
  if (file.length < 1024 * 1024 || file[0] !== 0x4d || file[1] !== 0x5a) {
    throw new Error("Le programme d’installation du runtime Visual C++ est invalide.");
  }

  await writeFile(
    path.join(resourceRoot, "installer.nsh"),
    [
      '!include "LogicLib.nsh"',
      "",
      "!macro customInstall",
      "  SetRegView 64",
      '  ReadRegDWORD $0 HKLM "SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" "Installed"',
      "  ${If} $0 != 1",
      '    File /oname=$PLUGINSDIR\\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}/vc_redist.x64.exe"',
      '    ExecShellWait "runas" "$PLUGINSDIR\\vc_redist.x64.exe" "/install /quiet /norestart" SW_HIDE',
      '    ReadRegDWORD $0 HKLM "SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" "Installed"',
      "    ${If} $0 != 1",
      '      MessageBox MB_ICONSTOP "Le runtime Visual C++ est requis. Autorisez son installation pour continuer."',
      "      Abort",
      "    ${EndIf}",
      "  ${EndIf}",
      "!macroend",
      "",
    ].join("\r\n"),
  );
}

async function prepareDefaultMedia() {
  const entries = await readdir(sourceMediaRoot, { withFileTypes: true });
  const images = entries.filter(
    (entry) => entry.isFile() && /\.(jpe?g|png|gif|webp|avif)$/i.test(entry.name),
  );
  if (images.length === 0) {
    throw new Error(`Aucune image compatible trouvée dans ${sourceMediaRoot}.`);
  }

  await rm(defaultMediaRoot, { recursive: true, force: true });
  await mkdir(defaultMediaRoot, { recursive: true });
  await Promise.all(
    images.map((image) =>
      cp(path.join(sourceMediaRoot, image.name), path.join(defaultMediaRoot, image.name)),
    ),
  );
  console.log(`${images.length} images par défaut préparées.`);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

await mkdir(resourceRoot, { recursive: true });
await preparePhp();
await prepareBackend();
await prepareVcRedist();
await prepareDefaultMedia();
console.log("Ressources Windows préparées.");
