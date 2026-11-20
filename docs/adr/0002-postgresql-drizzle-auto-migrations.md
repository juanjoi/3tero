# ADR 0002 — PostgreSQL + Drizzle with automatic migrations on startup

- Status: accepted · 2026-11-20 (replaces the initial SQLite idea)

## Context
A PostgreSQL server already runs on the mini PC. The owner wants the application to control schema evolution without manual SQL on each deploy.

## Decision
- Dedicated database and role (owner of the database) on the existing server.
- Schema in TypeScript with **Drizzle ORM**; `drizzle-kit generate` creates versioned SQL migrations committed to `server/db/migrations/`.
- A Nitro startup plugin runs `migrate()` under a Postgres **advisory lock** before serving; a failing migration aborts startup.
- Migrations are append-only; destructive changes in two releases (expand → contract).
- Full-text search with Postgres (`tsvector` + `unaccent` + `pg_trgm`, trusted extensions created by the DB owner).
- Local development uses a Postgres container from `docker-compose.dev.yml`.

## Consequences
- Zero manual DB intervention per deploy; `pg_dump` before releases with migrations.
- Requires PostgreSQL ≥ 13 (trusted extensions).
