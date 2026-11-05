import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { Readable } from "node:stream";
import type { AppPaths, BackendStatus } from "../shared/ipc";

/** `php -S` child: no stdin, piped stdout/stderr. */
type ServerProcess = ChildProcessByStdio<null, Readable, Readable>;

export type PhpBinary = {
  /** Executable: `php`, `tools/php.sh` (Linux dev wrapper) or the bundled php.exe. */
  command: string;
  /** Extra arguments prepended to every invocation (e.g. -d extension=…). */
  preArgs: string[];
};

export type BackendOptions = {
  php: PhpBinary;
  paths: AppPaths;
  defaultMediaDir?: string;
  onStatus?: (status: BackendStatus) => void;
};

const HEALTH_TIMEOUT_MS = 15_000;
const MAX_LOG_LINES = 200;

const INITIAL_STATUS: BackendStatus = {
  state: "stopped",
  url: null,
  healthy: false,
  version: null,
  php: null,
  migrations: null,
  database: null,
  error: null,
};

export function seedDefaultMedia(sourceDir: string, mediaDir: string, markerFile: string): void {
  if (fs.existsSync(markerFile)) return;
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Dossier des images par défaut introuvable : ${sourceDir}`);
  }

  const images = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(jpe?g|png|gif|webp|avif)$/i.test(entry.name));
  if (images.length === 0) {
    throw new Error(`Aucune image compatible dans le dossier : ${sourceDir}`);
  }

  fs.mkdirSync(mediaDir, { recursive: true });
  for (const image of images) {
    const destination = path.join(mediaDir, image.name);
    if (!fs.existsSync(destination)) {
      fs.copyFileSync(path.join(sourceDir, image.name), destination);
    }
  }
  fs.mkdirSync(path.dirname(markerFile), { recursive: true });
  fs.writeFileSync(markerFile, new Date().toISOString(), "utf8");
}

/**
 * Owns the local Laravel process: data directories, first-run .env, migrations,
 * then `php -S` bound to 127.0.0.1. Everything is driven by the desktop host so
 * the application works offline with no external service.
 */
export class BackendManager {
  private child: ServerProcess | null = null;
  private port: number | null = null;
  private statusValue: BackendStatus = { ...INITIAL_STATUS };
  private pendingStart: Promise<BackendStatus> | null = null;
  private log: string[] = [];

  constructor(private readonly options: BackendOptions) {}

  get status(): BackendStatus {
    return this.statusValue;
  }

  get lastLog(): string {
    return this.log.join("\n");
  }

  async start(): Promise<BackendStatus> {
    if (this.pendingStart) return this.pendingStart;
    if (this.statusValue.state === "running" && this.statusValue.healthy) return this.statusValue;

    this.pendingStart = this.doStart().finally(() => {
      this.pendingStart = null;
    });

    return this.pendingStart;
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.port = null;

    if (child && !child.killed) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 3000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill("SIGTERM");
      });
    }

    this.emit({ ...INITIAL_STATUS });
  }

  async restart(): Promise<BackendStatus> {
    await this.stop();
    return this.start();
  }

  /** Refreshes the status by probing /api/health when the server is up. */
  async probe(): Promise<BackendStatus> {
    if (this.statusValue.state !== "running") return this.statusValue;
    const health = await this.fetchHealth();
    if (health) {
      this.applyHealth(health);
    } else {
      this.emit({
        ...this.statusValue,
        state: "error",
        healthy: false,
        error: "Le serveur local ne répond plus.",
      });
    }
    return this.statusValue;
  }

  private async doStart(): Promise<BackendStatus> {
    const { php, paths } = this.options;

    this.emit({ ...this.statusValue, state: "starting", error: null });

    try {
      this.ensureDirectories();
      if (this.options.defaultMediaDir) {
        seedDefaultMedia(
          this.options.defaultMediaDir,
          paths.mediaDir,
          path.join(paths.dataDir, ".default-media-imported"),
        );
      }
      this.ensureEnvFile();

      const port = await findFreePort();
      const migrate = await this.runPhp(
        ["artisan", "migrate", "--force", "--no-interaction"],
        paths.backendDir,
      );
      if (migrate.code !== 0) {
        throw new Error(`Migration impossible :\n${migrate.output.trim()}`);
      }

      await this.importSongs(paths);
      await this.importBible(paths);

      const publicDir = path.join(paths.backendDir, "public");
      const router = path.join(publicDir, "index.php");
      const child: ServerProcess = spawn(
        php.command,
        [...php.preArgs, "-S", `127.0.0.1:${port}`, "-t", publicDir, router],
        {
          cwd: paths.backendDir,
          env: this.childEnv(),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      this.child = child;
      this.port = port;

      child.stdout.on("data", (chunk: Buffer) => this.appendLog(chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => this.appendLog(chunk.toString()));
      child.on("exit", (code, signal) => {
        if (this.child === child) {
          this.child = null;
          this.port = null;
          this.emit({
            ...this.statusValue,
            state: "stopped",
            healthy: false,
            url: null,
            error: `Serveur local arrêté (code ${code ?? "n/a"}${signal ? `, signal ${signal}` : ""}).`,
          });
        }
      });

      const health = await this.waitHealthy(port, HEALTH_TIMEOUT_MS);
      this.applyHealth(health);
      return this.statusValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stop();
      this.emit({ ...INITIAL_STATUS, state: "error", error: message });
      return this.statusValue;
    }
  }

  /**
   * Import configured translations into SQLite (phase 6), right after the
   * migrations. `--if-missing` keeps the next startups fast; failures are
   * logged without blocking the workspace.
   */
  private async importBible(paths: AppPaths): Promise<void> {
    const sources = [
      {
        file: findBibleFile(paths),
        missing: "Bible : fichier bible-ls1910.json introuvable, import ignoré.",
        failed: "Bible : l'import a échoué, l'onglet Bible reste indisponible.",
      },
      {
        file: findMalagasyBibleFile(paths),
        missing: "Bible malgache : fichier Bible_MG65.json introuvable, import ignoré.",
        failed: "Bible malgache : l'import a échoué, vérifiez le fichier et ses métadonnées.",
      },
    ];

    for (const source of sources) {
      if (!source.file) {
        this.appendLog(source.missing);
        continue;
      }

      const result = await this.runPhp(
        ["artisan", "bible:import", source.file, "--if-missing", "--no-interaction"],
        paths.backendDir,
      );
      const message = result.output.trim() || `Bible : import terminé (code ${result.code}).`;
      this.appendLog(message);

      if (result.code !== 0) {
        this.appendLog(source.failed);
      }
    }
  }

  private async importSongs(paths: AppPaths): Promise<void> {
    const file = findSongsFile(paths);

    if (!file) {
      this.appendLog("Chants : fichier addF_r6.json introuvable, import ignoré.");
      return;
    }

    const result = await this.runPhp(
      ["artisan", "songs:import", file, "--no-interaction"],
      paths.backendDir,
    );
    const message = result.output.trim() || `Chants : import terminé (code ${result.code}).`;
    this.appendLog(message);

    if (result.code !== 0) {
      this.appendLog("Chants : l'import a échoué, vérifiez le fichier JSON du recueil.");
    }
  }

  private childEnv(): NodeJS.ProcessEnv {
    const { paths } = this.options;
    return {
      ...process.env,
      CHURCH_DATA_DIR: paths.dataDir,
      CHURCH_DATABASE: paths.databaseFile,
      CHURCH_MEDIA_DIR: paths.mediaDir,
      LOG_PATH: path.join(paths.logDir, "laravel.log"),
      APP_VERSION: "0.1.0",
    };
  }

  private ensureDirectories(): void {
    const { paths } = this.options;
    for (const dir of [
      paths.dataDir,
      path.dirname(paths.databaseFile),
      paths.mediaDir,
      paths.backupDir,
      paths.logDir,
      paths.settingsDir,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * First run: create .env from the template with a freshly generated key.
   * The file lives in the backend folder (never committed), so an installed
   * copy must be able to bootstrap itself.
   */
  private ensureEnvFile(): void {
    const { backendDir } = this.options.paths;
    const envFile = path.join(backendDir, ".env");
    if (fs.existsSync(envFile)) return;

    const templateFile = path.join(backendDir, ".env.example");
    const template = fs.existsSync(templateFile)
      ? fs.readFileSync(templateFile, "utf8")
      : DEFAULT_ENV_TEMPLATE;

    const key = `base64:${randomBytes(32).toString("base64")}`;
    const contents = template
      .replace(/^APP_KEY=.*$/m, `APP_KEY=${key}`)
      .replace(/^APP_ENV=.*$/m, "APP_ENV=production")
      .replace(/^APP_DEBUG=.*$/m, "APP_DEBUG=false")
      .replace(/^APP_URL=.*$/m, "APP_URL=http://127.0.0.1")
      .replace(/^APP_LOCALE=.*$/m, "APP_LOCALE=fr")
      .replace(/^SESSION_DRIVER=.*$/m, "SESSION_DRIVER=file");

    fs.writeFileSync(envFile, contents, { encoding: "utf8", mode: 0o600 });
  }

  private runPhp(args: string[], cwd: string): Promise<{ code: number; output: string }> {
    const { php } = this.options;
    return new Promise((resolve) => {
      const child = spawn(php.command, [...php.preArgs, ...args], {
        cwd,
        env: this.childEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on("error", (error) => resolve({ code: 1, output: error.message }));
      child.on("close", (code) => resolve({ code: code ?? 1, output }));
    });
  }

  private async waitHealthy(port: number, timeoutMs: number): Promise<HealthPayload> {
    const deadline = Date.now() + timeoutMs;
    let lastError = "démarrage";

    while (Date.now() < deadline) {
      if (this.child === null) {
        throw new Error(`Le serveur local s'est arrêté pendant le démarrage.\n${this.lastLog}`);
      }
      const health = await this.fetchHealth(port);
      if (health) return health;
      lastError = "pas de réponse";
      await sleep(250);
    }

    throw new Error(
      `Le serveur local n'a pas répondu en ${Math.round(timeoutMs / 1000)} s (${lastError}).\n${this.lastLog}`,
    );
  }

  private async fetchHealth(port = this.port): Promise<HealthPayload | null> {
    if (port === null) return null;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok && response.status !== 503) return null;
      return (await response.json()) as HealthPayload;
    } catch {
      return null;
    }
  }

  private applyHealth(health: HealthPayload): void {
    const { port } = this;
    const ok = health.status === "ok";
    this.emit({
      state: ok ? "running" : "error",
      url: port === null ? null : `http://127.0.0.1:${port}`,
      healthy: ok,
      version: health.version ?? null,
      php: health.php ?? null,
      migrations: health.checks?.migrations ?? null,
      database: health.database?.path ?? null,
      error: ok ? null : formatHealthErrors(health),
    });
  }

  private appendLog(chunk: string): void {
    this.log = [...this.log, ...chunk.split("\n")].filter(Boolean).slice(-MAX_LOG_LINES);
  }

  private emit(status: BackendStatus): void {
    this.statusValue = status;
    this.options.onStatus?.(status);
  }
}

type HealthPayload = {
  status: string;
  version?: string;
  php?: string;
  database?: { path?: string };
  checks?: { migrations?: number };
  errors?: Record<string, string>;
};

function formatHealthErrors(health: HealthPayload): string {
  const errors = Object.entries(health.errors ?? {});
  if (errors.length === 0) return "Le serveur local signale un état dégradé.";
  return errors.map(([key, value]) => `${key} : ${value}`).join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() =>
        port ? resolve(port) : reject(new Error("Impossible de libérer un port.")),
      );
    });
  });
}

/**
 * Where the bundled translation JSON lives. Order matters: a packaged build
 * ships it inside the backend folder, a dev checkout reuses the web app's
 * `public/` copy (one file, one source of truth). `CHURCH_BIBLE_FILE`
 * overrides both for tests and portable installs.
 */
function findBibleFile(paths: AppPaths): string | null {
  const candidates = [
    process.env.CHURCH_BIBLE_FILE,
    path.join(paths.backendDir, "database", "bible-ls1910.json"),
    path.join(paths.backendDir, "..", "public", "bible-ls1910.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function findMalagasyBibleFile(paths: AppPaths): string | null {
  const candidates = [
    process.env.CHURCH_BIBLE_MG_FILE,
    path.join(paths.backendDir, "database", "seeders", "Bible_MG65.json"),
    path.join(paths.backendDir, "..", "Bible_MG65.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function findSongsFile(paths: AppPaths): string | null {
  const candidates = [
    process.env.CHURCH_SONGS_FILE,
    path.join(paths.backendDir, "database", "seeders", "addF_r6.json"),
    path.join(paths.backendDir, "..", "addF_r6.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const DEFAULT_ENV_TEMPLATE = `APP_NAME="ADD Church Presentaion"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://127.0.0.1
APP_LOCALE=fr
LOG_CHANNEL=stack
DB_CONNECTION=sqlite
SESSION_DRIVER=file
CACHE_STORE=file
`;
