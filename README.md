# Screenshot Match

Implement exactly the screenshot and nothing else

Project documents :

- [`PLAN.md`](PLAN.md) — implementation plan (cahier des charges v2, corrected order of phases)
- [`docs/phase-1-cadrage.md`](docs/phase-1-cadrage.md) — Phase 1 scoping: target environments, acceptance criteria, Bible licences, user-data location

## Repository layout

| Folder             | What it is                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/`, `public/`  | Web app (TanStack Start) — Lovable preview, unchanged                                                                                |
| `apps/desktop/`    | Electron desktop app: VideoPsalm-style workspace, admin console and independent projection window ([README](apps/desktop/README.md)) |
| `backend/`         | Laravel/PHP local API on SQLite (health, songs, programs, Bible with FTS5 search)                                                    |
| `tools/`           | Local PHP helpers (`php.sh` wrapper, `setup-php-ext.sh`, composer)                                                                   |
| `docs/`, `PLAN.md` | Planning and decisions                                                                                                               |

Quick start for the desktop app:

```sh
cd apps/desktop && npm install && npm run dev   # needs PHP 8.3 + pdo_sqlite
```

Backend tests:

```sh
cd backend && ../tools/php.sh vendor/bin/phpunit
```

Bible import (runs automatically at app startup, `--if-missing`):

```sh
cd backend && ../tools/php.sh artisan bible:import
```

Export a SQLite database to JSON (one array of records per table):

```sh
python3 tools/db_to_json.py addF_r6.db
# Writes addF_r6.json; optionally specify another output path:
python3 tools/db_to_json.py addF_r6.db export.json
```

The desktop app imports `addF_r6.json` into its song library on startup. It
imports the 543 entries only once, keeping the existing songs and edits.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0addecb0-fac3-4252-80a6-c22e86848b37).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
