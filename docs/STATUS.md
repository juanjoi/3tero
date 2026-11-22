# Status

> Update this file at the end of every work session.

**Current phase:** MVP + v1.x complete → next: naming decision, real-world use, "Later" items
**Last update:** 2026-11-22

## Done
- **Phase 0**: plan, ADRs, mockups, research (MakerWorld, Bambu 3MF + parser prototype).
- **Phase 1**: Nuxt 4 + Nuxt UI scaffold, theme (light/dark), PWA + share target, Drizzle schema + auto migrations, Docker.
- **Phase 2**: storage (streamed uploads, limits, quota, WebP), projects/images/files/materials/tags API, home, detail, catalogue, settings, kanban (removed 2026-11-22).
- **Phase 3**: Bambu 3MF + STL parsers (unit-tested, 13 real files), auto-filled file data, thumbnails, A1 mini fit check, 3D viewer, print log with price snapshot.
- **UI without popups** ([ADR 0006](adr/0006-inline-ui-no-popups.md)): inline catalogue forms, expandable file rows (actions, inline 3D viewer with fullscreen, editor), print log page `/projects/:id/print`, inline project options, `ConfirmButton`.
- **Phase 5 — import**: `server/lib/importers` (`ProjectImporter` registry, MakerWorld: design API → `__NEXT_DATA__` → Open Graph, anti-bot detection without bypass), preview + commit endpoints (cached draft, duplicate detection, images copied from allow-listed CDN, BOM → materials, raw JSON + chosen profile in `project_sources`), `/import` page (Android share target, photo selection, profile picker with A1 mini preselected). Imported profile is the project estimate until a 3MF is uploaded; uploaded 3MF is checked against the imported design.
- **v1.x**:
  - Filament stock (`filaments.stock_grams`, deducted by prints, restored when a print is deleted, "not enough filament" warning).
  - Shopping list `/shopping` (BOM materials + filament shortfalls of pending projects; ticks shared via `settings`).
  - Saved filters, tag chips, priority / MakerWorld filters, grid / list view, bulk actions (`/api/bulk/projects`), duplicate project.
  - Statistics `/stats`.
  - **Translate imports to Spanish** ([ADR 0008](adr/0008-translation-with-libretranslate.md)): "Traducir al español" / "Ver original" on the import review (title, description, tags) with a self-hosted LibreTranslate (shared service on the server); enabled by `NUXT_TRANSLATE_URL`. MakerWorld itself only offers English translations. Slow on CPU (~30 s for a long description) and single-word tags translate poorly.
  - **Import from the user's browser** ([ADR 0007](adr/0007-import-from-the-user-browser.md)): MakerWorld challenges the production server even on the API, so the bookmarklet "3tero" (Ajustes) or "pegar datos" send the design JSON read by the browser; the bookmarklet opens `/import#link=…&d=<gzip+base64url>` (a navigation: MakerWorld's CSP `form-action 'self' https:` blocks a form post to HTTP 3tero). Import errors are logged with their cause (`[import] makerworld failed …`) and 429/5xx are reported as temporary.
  - Kanban board `/board` removed (2026-11-22): no use for us; status changes from the detail stepper and bulk actions. Statistics now in the phone bottom bar.
  - Backup / restore ZIP ([ops/backup.md](ops/backup.md)), verified round-trip and invalid-file rejection.
- **Release pipeline**: GitHub Actions checks every push/PR (typecheck, tests, build) and publishes `ghcr.io/juanjoi/3tero:X.Y.Z` on `vX.Y.Z` tags.
- Tests: 56 unit tests (cost, schemas, 3MF/STL parsers, MakerWorld importer on a real trimmed fixture).
- Dev DB contains `[Demo]` projects, imported "Flexi skeleton" and auto-created filaments — safe to delete.

## Next steps
1. [x] Name chosen: **3tero** (technical id `trestero`) + logo ([design/logo](design/logo/README.md)).
2. [x] Deployed on the mini PC (v1.1.0). [ ] Try the bookmarklet from desktop and Android Chrome on a real MakerWorld page; collect feedback.
3. [ ] Small gaps vs PROJECT_PLAN §3: tag colours, markdown rendering for description/notes, group-by in lists, filament type/colour filter, gallery reordering.
4. [ ] Parse very large 3MF in a worker thread (today main thread, ~0.1–0.7 s on real files; only matters for >100 MB files).
5. [ ] "Later": other importers (Printables, Thingiverse…) behind `ProjectImporter`; authentication if ever exposed without VPN (ADR 0003).

## Notes / gotchas
- `rolldown` is an explicit devDependency: without it `npm ci` inside the Linux Docker build fails (lockfile created on macOS).
- `@nuxt/fonts` downloads Google Fonts at build time (needs Internet).
- Components are auto-imported **without folder prefix** (`pathPrefix: false`): keep file names unique.
- PATCH schemas must not default or null missing keys (`projectUpdateSchema`, `fileUpdateSchema` — covered by tests).
- `motion-v` was dropped: SSR-rendered items stayed at `initial` (invisible). Use Vue transitions.
- vue-tsc quirk: an attribute containing `https://` (e.g. `placeholder="https://…"`) makes vue-tsc report a bogus `Property 'value' does not exist` on the next `v-model`. Avoid `//` in static attributes.
- Components must not use top-level `await useFetch` (only pages): a component mounted later under `v-if` never rendered.
- **No popups** ([ADR 0006](adr/0006-inline-ui-no-popups.md)): no modals, slide-overs or dropdown menus. Inline panels, dedicated pages, `ConfirmButton` (two taps). Toasts are fine.
- Docker Desktop disk can fill up (Postgres then fails with "No space left on device"): `docker builder prune`.

- API routes under `/api/projects/<word>` collide with `/api/projects/:id` in Nitro typed fetch (types become `{}`): bulk lives at `/api/bulk/projects`.
- MakerWorld `DesignModelId` inside a 3MF is the design `modelId` hash, not the URL id (see research/bambu-3mf.md).
- MakerWorld: the model **HTML page** is always challenged for servers; the design **API** depends on the network — fine from a home Mac, **challenged from the mini PC**. Never bypass it: the browser import (ADR 0007) is the way. The bookmarklet's form-post version was blocked by MakerWorld's CSP in a real tab; the navigation version is verified up to `/import` decoding in Chrome, still to be confirmed from a real MakerWorld tab.
- Editing server files while a request is in flight restarts Nitro in dev and drops that request (seen with uploads).

## Blockers / open questions
- None.
