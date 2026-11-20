# Status

> Update this file at the end of every work session.

**Current phase:** 3 — Prints & 3MF (done) → next: 5 — MakerWorld import
**Last update:** 2026-11-20

## Done
- Phase 0: plan, ADRs, mockups, research (MakerWorld, Bambu 3MF + parser prototype).
- Phase 1: Nuxt 4 + Nuxt UI scaffold, theme (light/dark), PWA + share target, Drizzle schema + auto migrations, Docker.
- Phase 2:
  - Storage on the data volume: streamed multipart uploads (busboy), size/count limits, total quota (507), WebP re-encoding + thumbnails (sharp), `/media/**` route with path-traversal guard.
  - API: projects (list with search/filters/sort, CRUD, archive/restore/hard delete, status + history), images, model files (STL/3MF detection, iterations, final flag, filaments & grams per file, download), project materials, filaments & materials catalogue, tags, storage settings.
  - UI: home (search, status chips, tag filter, sort, animated grid), create/edit form, project detail (gallery with camera upload, status stepper, KPIs, tabs Files/Materials/Notes/Info, file edit modal with live cost), materials catalogue, settings (theme, storage, archived), kanban board (drag & drop + "move to" menu for touch).
  - Tests: cost utils and validation schemas (16 tests).
- Phase 3:
  - `server/lib/bambu3mf.ts` + `server/lib/stl.ts` (pure, unit-tested; verified on 13 real public files): plates, time, grams per filament, printer, bbox, thumbnail.
  - On upload: file kind auto-detected (sliced/model), time + grams + filaments filled, catalogue matching (type + colour, preferring Bambu preset; unknown filaments auto-created at `NUXT_DEFAULT_FILAMENT_PRICE_PER_KG`), plate thumbnail stored as WebP, A1 mini fit check.
  - UI: thumbnails, fit badge, 3D viewer (three.js, lazy, STL + project 3MF), hints after upload (new filaments, "move to Laminado", too big).
  - Print log: API + "Registrar impresión" dialog (pre-filled from the file, live cost, photos, mark printed/final) + timeline tab with total spent. Price per kg is snapshotted per print.
- Dev DB contains two `[Demo]` projects and two filaments created for manual testing — safe to delete.

## Next steps
1. [ ] Phase 5 — MakerWorld importer (`docs/research/makerworld.md`): URL parser, design API → `__NEXT_DATA__` → OG fallbacks, profile picker (A1 mini preselected), images copied locally, raw JSON in `project_sources`, Android share target → `/import`.
2. [ ] Link a 3MF to its MakerWorld project via `DesignModelId` metadata.
3. [ ] v1.x: backup/export, filament inventory, shopping list, saved filters, stats.
4. [ ] Parse very large 3MF in a worker thread (today: main thread, ~0.1–0.7 s on real files).

## Notes / gotchas
- `rolldown` is an explicit devDependency: without it `npm ci` inside the Linux Docker build fails (lockfile created on macOS).
- `@nuxt/fonts` downloads Google Fonts at build time (needs Internet).
- Components are auto-imported **without folder prefix** (`pathPrefix: false`): keep file names unique.
- PATCH schemas must not default or null missing keys (`projectUpdateSchema`, `fileUpdateSchema` — covered by tests).
- `motion-v` was dropped: SSR-rendered items stayed at `initial` (invisible). Use Vue transitions.
- vue-tsc quirk: a `v-model` on a field placed right after a `<UCollapsible>` with `#content` slot reported a bogus `.value` error; moving the field before it fixed it.
- Components must not use top-level `await useFetch` (only pages): a component mounted later under `v-if` (dialogs) never rendered.
- Docker Desktop disk can fill up (Postgres then fails with "No space left on device"): `docker builder prune`.

## Blockers / open questions
- Final name (working name: Layra; options in PROJECT_PLAN §1).
