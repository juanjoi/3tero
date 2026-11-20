# Layra (working name)

Self-hosted PWA to manage the family's 3D printing projects: model iterations (STL/3MF), photos, materials, cost, priority, status, tags, print log and MakerWorld import.

Status: **phase 1 — foundations** · see [docs/STATUS.md](docs/STATUS.md).

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
| Production image | `docker build -t layra:latest .` |

## Production

1. Create role + database on the PostgreSQL server ([docs/ops/database.md](docs/ops/database.md)).
2. Copy `docker-compose.yml` and a `.env` (from `.env.example`, with the real `NUXT_DATABASE_URL`) to the host.
3. `docker compose up -d --build` → container on port 3000 → point the reverse proxy to it.
4. Back up: `pg_dump` + the `./data` folder.

## Project layout

```
app/                 Vue frontend (pages, layouts, components, theme)
server/api/          REST endpoints (Nitro)
server/db/           Drizzle schema + SQL migrations
server/plugins/      startup migrator (advisory lock)
server/utils/        db client and shared helpers
public/              PWA icons
docs/                plan, status, ADRs, design, research, ops
```

## Documentation
- [Project plan](docs/PROJECT_PLAN.md) · [Status](docs/STATUS.md) · [Decisions](docs/adr/) · [Design](docs/design/README.md) · [Research](docs/research/) · [Ops](docs/ops/)

## Stack
Nuxt 4 · Nuxt UI 4 · Tailwind 4 · @vite-pwa/nuxt · PostgreSQL + Drizzle · Docker
