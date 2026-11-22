# 3tero

<img src="docs/design/logo/symbol.svg" alt="" width="72">

*3tero* (read "trastero", a storage room): the shelf where the family keeps its 3D printing projects.

Self-hosted PWA to manage the family's 3D printing projects: model iterations (STL/3MF), photos, materials, cost, priority, status, tags, print log and MakerWorld import.

Status: **MVP + v1.x complete** · see [docs/STATUS.md](docs/STATUS.md).

## Features

- Projects with photo gallery (camera upload), tags, priority, status (modeling → sliced → printed) with history, notes, duplicate, archive.
- Model files as iterations (STL / 3MF): Bambu Studio / OrcaSlicer 3MF auto-fills time, grams per filament, plates, thumbnail; A1 mini build-volume check; in-browser 3D viewer.
- Print log with real grams, time, photos and cost (price snapshot); total spent per project.
- Filament & materials catalogue with stock tracking ("not enough filament" warning).
- MakerWorld import: paste or share a link from Android → title, photos, tags, designer, license, print profile (A1 mini preselected), bill of materials.
- Home: search, status / tag / priority / source filters, saved filters, grid or list, bulk actions.
- Shopping list, statistics, full backup / restore (ZIP).

## Quick start (development)

Requirements: Node ≥ 22 (Docker image uses Node 26 LTS), Docker.

```bash
cp .env.example .env                                  # defaults point to the dev database
docker compose -f docker-compose.dev.yml up -d --wait # PostgreSQL 19
npm install
npm run dev                                           # http://localhost:3000
```

Migrations are applied automatically when the server starts. Health: `GET /api/health`.

## Common tasks

| Task | Command |
|---|---|
| Change the DB schema | edit `server/db/schema.ts` → `npm run db:generate` → commit the new file in `server/db/migrations/` |
| Browse the DB | `npm run db:studio` (needs `NUXT_DATABASE_URL` in the shell env) |
| Type check | `npm run typecheck` |
| Tests | `npm test` |
| Regenerate PWA icons | edit `public/logo.svg` → `npm run pwa:assets` |
| Production image | `docker build -t trestero:latest .` |

## Production

Each `vX.Y.Z` tag publishes the image `ghcr.io/juanjoi/3tero:X.Y.Z` ([workflow](.github/workflows/image.yml)); every push and pull request runs typecheck, tests and build first. Use the published image instead of building on the host.

1. Create role + database on the PostgreSQL server ([docs/ops/database.md](docs/ops/database.md)).
2. Copy `docker-compose.yml` and a `.env` (from `.env.example`, with the real `NUXT_DATABASE_URL`) to the host.
3. `docker compose up -d` with `image: ghcr.io/juanjoi/3tero:<version>` (or `--build` to build locally) → container on port 3000 → point the reverse proxy to it.
4. Back up: **Ajustes → Copia de seguridad** (one ZIP), or `pg_dump` + the `./data` folder ([docs/ops/backup.md](docs/ops/backup.md)).

## Project layout

```
app/                 Vue frontend (pages, layouts, components, theme)
server/api/          REST endpoints (Nitro)
server/db/           Drizzle schema + SQL migrations
server/plugins/      startup migrator (advisory lock)
server/utils/        db client, storage, projects, imports, backup helpers
server/lib/          pure, unit-tested parsers: Bambu 3MF, STL, importers (MakerWorld)
shared/utils/        domain constants, zod schemas, cost helpers (client + server)
test/                vitest unit tests (+ fixtures)
public/              PWA icons
docs/                plan, status, ADRs, design, research, ops
```

## Documentation
- [Project plan](docs/PROJECT_PLAN.md) · [Status](docs/STATUS.md) · [Decisions](docs/adr/) · [Design](docs/design/README.md) · [Research](docs/research/) · [Ops](docs/ops/)

## Stack
Nuxt 4 · Nuxt UI 4 · Tailwind 4 · @vite-pwa/nuxt · PostgreSQL + Drizzle · Docker
