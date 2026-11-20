# Status

> Update this file at the end of every work session.

**Current phase:** 1 — Foundations (in progress)
**Last update:** 2026-11-20

## Done
- Phase 0: plan v0.3, ADRs, mockups v1 ([design/](design/README.md)), research on MakerWorld and Bambu 3MF (+ parser prototype).
- Phase 1 (partial):
  - Nuxt 4 + Nuxt UI 4 scaffold, green theme tokens, Inter/Space Grotesk, responsive layout (bottom nav on phone, side nav on tablet/desktop).
  - Placeholder pages: home (search + status chips + empty state), import (reads the Android share-target params), board, materials, settings.
  - Drizzle schema v1 (all tables of the plan) + migrations `0000_extensions` (pg_trgm, unaccent) and `0001_init`.
  - Startup migrator with advisory lock; `/api/health` with DB status and schema version.
  - PWA manifest with share target + generated icons.
  - `docker-compose.dev.yml` (PostgreSQL 19), `Dockerfile` (Node 26 alpine), `docker-compose.yml`, `.env.example`.
  - Verified: dev server, migrations on an empty DB, production image running against Postgres, typecheck.

## Next steps
1. [ ] File storage service (`unstorage` on `NUXT_DATA_DIR`) with limits + quota, image processing with `sharp` (WebP + thumbnails).
2. [ ] Dark mode tokens.
3. [ ] Vitest setup with a first test (e.g. cost calculation util).
4. [ ] Phase 2 — Core: project CRUD API + forms, gallery, tags, filaments/materials catalogue.

## Notes / gotchas
- `rolldown` is an explicit devDependency: without it `npm ci` inside the Linux Docker build fails (`Cannot find package 'rolldown'` from `@vite-pwa`), because the lockfile is created on macOS.
- `fonts` are fetched by `@nuxt/fonts` at build time (Google Fonts) — the build needs Internet access.

## Blockers / open questions
- Final name (working name: Layra; options in PROJECT_PLAN §1).
- Mockup feedback.
