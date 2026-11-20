# Status

> Update this file at the end of every work session.

**Current phase:** 2 — Core (mostly done) → next: 3 — Prints & 3MF
**Last update:** 2026-11-20

## Done
- Phase 0: plan, ADRs, mockups, research (MakerWorld, Bambu 3MF + parser prototype).
- Phase 1: Nuxt 4 + Nuxt UI scaffold, theme (light/dark), PWA + share target, Drizzle schema + auto migrations, Docker.
- Phase 2:
  - Storage on the data volume: streamed multipart uploads (busboy), size/count limits, total quota (507), WebP re-encoding + thumbnails (sharp), `/media/**` route with path-traversal guard.
  - API: projects (list with search/filters/sort, CRUD, archive/restore/hard delete, status + history), images, model files (STL/3MF detection, iterations, final flag, filaments & grams per file, download), project materials, filaments & materials catalogue, tags, storage settings.
  - UI: home (search, status chips, tag filter, sort, animated grid), create/edit form, project detail (gallery with camera upload, status stepper, KPIs, tabs Files/Materials/Notes/Info, file edit modal with live cost), materials catalogue, settings (theme, storage, archived), kanban board (drag & drop + "move to" menu for touch).
  - Tests: cost utils and validation schemas (16 tests).
- Dev DB contains two `[Demo]` projects and two filaments created for manual testing — safe to delete.

## Next steps (phase 3)
1. [ ] Port the 3MF parser prototype (`docs/research/prototypes/parseBambu3mf.ts`) to `server/utils/bambu3mf.ts` (worker thread, zip-bomb guards) and run it on upload: plates, time, grams per filament (match catalogue by `bambuPresetId`/colour), thumbnail, fit check for A1 mini.
2. [ ] STL bbox + fit check.
3. [ ] 3D viewer (three.js ≥ r174, lazy-loaded) for STL / project 3MF; thumbnail for sliced files.
4. [ ] Print log (API + "Registrar impresión" sheet + timeline tab) with real cost.
5. [ ] Suggest status change (sliced file uploaded → "Laminado"; successful print → "Impreso" + final).
6. [ ] Then phase 5: MakerWorld importer (`docs/research/makerworld.md`).

## Notes / gotchas
- `rolldown` is an explicit devDependency: without it `npm ci` inside the Linux Docker build fails (lockfile created on macOS).
- `@nuxt/fonts` downloads Google Fonts at build time (needs Internet).
- Components are auto-imported **without folder prefix** (`pathPrefix: false`): keep file names unique.
- PATCH schemas must not default or null missing keys (`projectUpdateSchema`, `fileUpdateSchema` — covered by tests).
- `motion-v` was dropped: SSR-rendered items stayed at `initial` (invisible). Use Vue transitions.
- vue-tsc quirk: a `v-model` on a field placed right after a `<UCollapsible>` with `#content` slot reported a bogus `.value` error; moving the field before it fixed it.
- Docker Desktop disk can fill up (Postgres then fails with "No space left on device"): `docker builder prune`.

## Blockers / open questions
- Final name (working name: Layra; options in PROJECT_PLAN §1).
