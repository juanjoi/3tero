# Project Plan — 3D Printing Project Repository

> Name: **3tero** (read "trastero") — decided 2026-11-21, see [Naming](#1-naming)
> Status: draft v0.3 — 2026-11-20
> Related: [STATUS](STATUS.md) · [Decisions](adr/) · [Design](design/README.md) · [Research](research/)

---

## 0. Summary

A self-hosted web application, installable as a PWA on Android phones and tablets, to keep the family catalogue of 3D printing projects. Each project gathers everything needed to go from "I want to print this" to "it's printed": photos, model file iterations, materials, estimated cost, priority, status, tags and a log of every print.

Projects come from two sources:

1. **Manual** — models designed or downloaded by the user and uploaded by hand.
2. **Import** — paste or share (from Android) a MakerWorld URL and the app pre-fills the project with title, description, images, tags, designer and license. The importer is pluggable so other platforms (Printables, Thingiverse…) can be added later.

Guiding principle: **keep it simple**. Single codebase (Nuxt), single container, the existing PostgreSQL server, no authentication for now. The application owns its database schema: migrations run automatically on startup.

### Context

| Aspect | Decision |
|---|---|
| Users | Home use by the family. **No login** for now; multi-user may come later if the idea grows. |
| Hosting | Docker on an existing mini PC behind an existing reverse proxy. Deliverables: **Docker image + `docker-compose.yml`**, portable to another host. |
| Access | Home network, and from outside **only through VPN** (transparent to the app). |
| Database | **Existing PostgreSQL** on the mini PC: dedicated database + user. Schema managed by the app (automatic migrations). |
| Size | < 100 projects short term; **configurable storage quota** with usage shown in the UI. |
| Printer | **Bambu Lab A1 mini + AMS lite** (4 filaments, 180×180×180 mm build volume). |
| File formats | **STL and 3MF**. |
| Devices | **Android** (phone + tablet) and desktop browser. |
| Currency | **EUR**. Cost = filament grams only. |
| UI language | Spanish (i18n-ready). |

---

## 1. Naming

**Decision (2026-11-21): 3tero** — read "trastero" (a storage room): *the* place where the family keeps its 3D projects; the "3" brings the 3D.

- Display name: **3tero** (PWA name, titles, logo). Technical identifiers that cannot start with a digit use **trestero** (npm package, Docker image/service, PostgreSQL role & database).
- Logo: the "3" is a shelf holding printed parts (cube, letter **D**, cone) → the symbol reads "3D". Sources and how to change it: [design/logo/README.md](design/logo/README.md).
- Discarded candidates: Layra (working name until phase 5), Infill, Forja, Vértice, Kubo, Extrud, Nozl, Stratum, Bobbin, Voxa, Capazo, Panal, Capateca, Desván 3D, Trastero 3D, Arcón, Colmena, Proyectario, 3Dteca, Proyecta3D, Almacén 3D, Trastienda 3D, Proyectoteca, 3Dspensa, 3Dsván, 3Dpósito.

---

## 2. Goals and non-goals

### Goals
- Centralise all 3D printing projects (own and imported) in one place for the whole family.
- Fast capture from Android: share a MakerWorld link or take a photo and it's saved.
- Iterate on a model: keep several file versions, log each test print, mark the final one.
- Know at a glance what to print next (priority + status) and what it will cost.
- Search and filter by text, tags, status, priority and filament.
- A modern, animated, clean UI with a clear information hierarchy.

### Non-goals (for now)
- Authentication, user accounts, permissions.
- Public community features (likes, comments, followers).
- Slicing inside the app or sending jobs to the printer.
- Energy or hardware cost accounting.
- Offline editing.

---

## 3. Functional scope

### 3.1 Project
| Field | Type | Notes |
|---|---|---|
| Title | text | required |
| Description | markdown | optional; imported when available |
| Gallery | images[] | ordered; one marked as cover |
| Model files | files[] | STL / 3MF iterations, one can be marked **final** (see §3.3) |
| Materials | list | filaments (with grams) + other materials (with quantity) |
| Estimated cost | € | computed from the final file's filament grams (see §3.5) |
| Priority | enum | `low`, `medium`, `high` |
| Status | enum | `modeling` → `sliced` → `printed` |
| Tags | tag[] | free tags, autocomplete, colour per tag |
| Source | enum + url | `manual` / `makerworld` / future platforms + original URL |
| Designer / author | text | attribution |
| License | text | e.g. CC BY-NC-SA — relevant for imported models |
| Notes | markdown | tips, lessons learned |
| Created / updated | timestamps | |
| Archived | bool | soft delete instead of hard delete |

### 3.2 Materials
Stored in a reusable **catalogue** so they don't have to be retyped:

- **Filament**: type (PLA, PETG, TPU, PLA-CF…), brand, colour name + hex (rendered as swatch), **price per kg (€)**.
  Per file/print: grams used per filament (up to 4 with AMS lite).
- **Other material**: category (magnets, screws, inserts, electronics, motors, glue, bearings…), name/spec (e.g. "M3x8 DIN912", "Magnet 6×3 mm N52"), optional purchase link.
  Per project: quantity. **No price** — not part of the cost.

### 3.3 Model files and iterations
A project holds a **list of model files**, treated as iterations:

| Field | Notes |
|---|---|
| File | STL or 3MF, original name kept |
| Label / version | e.g. "v1", "v2 – thicker walls", "0.12 mm layers" |
| Kind | `model` (raw STL/3MF) or `sliced` (Bambu Studio 3MF with plate data) |
| Filaments & grams | typed manually or **auto-extracted from a sliced 3MF** |
| Estimated print time | idem |
| Notes | what changed in this iteration |
| Final | one file per project can be flagged as final |

- 3D preview of any file in the browser.
- Upload a new iteration from the detail page in one step; previous ones stay available.
- Download any file to open in Bambu Studio.

### 3.4 Print log
Every physical print attempt is recorded:

| Field | Notes |
|---|---|
| Date | defaults to now |
| File used | which iteration was printed |
| Result | `success`, `failed`, `partial` |
| Real grams per filament | defaults from the file's estimate, editable (useful for failed prints) |
| Real time | optional |
| Cost | computed from real grams |
| Photo(s) | of the result |
| Notes | what went wrong / right |

The log shows the evolution of a project ("v1 failed, v2 ok") and makes the final choice obvious. Logging a successful print can offer to move the project to `printed` and to mark that file as final.

### 3.5 Cost estimate
```
cost = Σ over filaments (grams × price_per_kg / 1000)    [€]
```
- **Estimated cost** of the project = cost of its final file (or latest, if none is final).
- **Real cost** of each print = cost of the real grams logged.
- **Total spent** on a project = Σ real cost of all logged prints (failures included).

### 3.6 Status workflow
```
 modeling ──► sliced ──► printed
     ▲           │           │
     └───────────┴───────────┘  (moving back is allowed)
```
- Each change stored in a **status history** (date, from, to).
- Status is changed from the project detail (stepper) or with bulk actions. A kanban board was built and later dropped (2026-11-22): not useful for a family catalogue.

### 3.7 Lists, search and filters
- Views: **card grid** (cover image), **compact list**.
- Full-text search over title, description, notes, tags, designer.
- Filters: tags (AND/OR), status, priority, source, filament type/colour.
- Sort: priority, updated, created, cost, title.
- Group by: tag, status, priority.
- Filter state kept in the URL (bookmarkable, back-button friendly).

### 3.8 Import (MakerWorld first, pluggable)
1. User pastes the URL, or shares it from Chrome / the MakerWorld app on Android (**Web Share Target**).
2. The server picks the importer whose URL pattern matches and extracts: title, description, images, tags, designer, license and, when available, print profile data (time, grams, filaments).
3. The user reviews a **pre-filled form** before saving.
4. Images are **downloaded and stored locally**.
5. The user picks a **print profile** (the one compatible with the A1 mini is preselected); it pre-fills estimated grams, time and filaments.
6. Model files **cannot be downloaded without a MakerWorld login** → the user uploads the 3MF/STL manually (a link to the model page is shown).

Verified details, endpoints and fallbacks: [research/makerworld.md](research/makerworld.md) · decision: [ADR 0005](adr/0005-makerworld-import-strategy.md).

When MakerWorld challenges the server (it does in production), the user's browser reads the data instead — **bookmarklet** "3tero" or **paste data** — and the server builds the same draft: [ADR 0007](adr/0007-import-from-the-user-browser.md).

Importer contract (one module per platform):
```ts
interface ProjectImporter {
  id: string                         // 'makerworld'
  matches(url: URL): boolean
  fetch(url: URL): Promise<ImportedProjectDraft>
}
```

### 3.9 Management
- Create, edit, duplicate, archive, restore, delete permanently.
- Bulk actions: change status, priority, tags, archive.

---

## 4. Feature roadmap

| # | Feature | Phase |
|---|---|---|
| 1 | Project CRUD, gallery (incl. camera upload), tags, materials catalogue | MVP ✅ |
| 2 | Model file iterations + in-browser 3D viewer (STL/3MF) | MVP ✅ |
| 3 | Print log + real cost | MVP ✅ |
| 4 | Status workflow (kanban dropped 2026-11-22) | MVP ✅ |
| 5 | Search, filters, sort, grouping | MVP ✅ |
| 6 | MakerWorld import + Android share target | MVP ✅ |
| 7 | Auto-extract grams/time/filaments/plates/thumbnails from Bambu 3MF ([research](research/bambu-3mf.md)) | **MVP** ✅ |
| 8 | Backup / export (ZIP with JSON + files) and restore | v1.x ✅ |
| 9 | Filament inventory (remaining grams per filament) — "can I print this now?" | v1.x ✅ |
| 10 | Shopping list from materials of pending projects (filter: high priority) | v1.x ✅ |
| 11 | Saved filters / smart collections | v1.x ✅ |
| 12 | Build-volume check: warn if a model exceeds 180×180×180 mm (mesh bbox / slicer `outside` flag) | MVP ✅ |
| 13 | Stats dashboard: prints per month, success rate, grams & € spent | ✅ (done early) |
| 14 | Other platforms' importers (Printables, Thingiverse…) | Later |
| 15 | Users / authentication | Later (if needed) |

---

## 5. UI / UX design

### 5.1 Principles
- **Modern and clean**: generous whitespace, few colours, soft shadows, rounded corners, light and dark mode (follows system).
- **Accent: green** (same family as Bambu Studio, but our own shade): `#15803D` for buttons/text on white (passes WCAG AA with white text), `#DDF4E4` as soft tint. Status colours: modeling blue `#1D4ED8`, sliced violet `#6D28D9`, printed green `#15803D`. Priority: high orange, medium amber, low grey.
- Typography: **Space Grotesk** for headings and numbers, **Inter** for body.
- Mockups: see [design/README.md](design/README.md).
- **Clear information hierarchy**: the image and title first, then status/priority, then everything else. Secondary data is progressive (collapsed sections, tabs, tooltips).
- **Animated, but purposeful**: motion explains changes (where something came from / went), never decorates for its own sake. Respect `prefers-reduced-motion`.
- **Mobile-first**: thumb-reachable actions, bottom navigation on phone, side navigation + list/detail split on tablet and desktop.

### 5.2 Hierarchy by screen
**Project card (grid)**
1. Cover image (dominant)
2. Title
3. Status badge + priority indicator (coloured dot/bar)
4. Tags (max 2–3 visible, "+n")
5. Estimated cost and filament swatches (subtle, small)

**Project detail**
1. Hero: gallery carousel + title + status stepper (modeling → sliced → printed) + priority
2. Primary actions: change status, log a print, upload iteration
3. Tabs / sections: **Files** (iterations, 3D preview, final flag) · **Prints** (timeline log) · **Materials** · **Notes** · **Info** (source, designer, license)

**Home**
- Search bar on top, filter chips below, view switcher (grid / list).
- Floating "+" button with options: new project, import from URL.

### 5.3 Motion catalogue
| Interaction | Animation |
|---|---|
| Card → detail navigation | Shared-element transition of the cover image (View Transitions API) |
| List filtering / sorting | Layout animation: cards reflow smoothly, enter/exit with fade + scale |
| Status change | Stepper fills progressively; subtle confetti on `printed` 🎉 |
| Loading | Skeleton placeholders instead of spinners |
| Buttons, chips, toggles | Micro-interactions (press scale, hover lift) |
| Import from URL | Step-by-step progress (fetching → images → ready) |
| 3D viewer | Auto-rotate on open, smooth orbit controls |

### 5.4 Tooling
- **Nuxt UI** (Tailwind CSS, Reka UI primitives): accessible components, theming via design tokens, dark mode.
- **Vue `TransitionGroup`** with CSS: enter/exit and FLIP reordering of lists.
- **View Transitions API** (Nuxt `experimental.viewTransition`): page and shared-element transitions.
- **Iconify** (Lucide / Phosphor) via Nuxt Icon.
- Typography: one modern sans (e.g. Inter or Geist).
- Mockups of the main screens before implementing (phase 0).

---

## 6. Non-functional requirements

- **Installable PWA** on Android: manifest, maskable icons, splash, standalone display, **share target**.
- **Offline**: read-only access to recently viewed projects and thumbnails (service worker cache).
- **Performance**: WebP thumbnails generated on upload (several sizes), lazy loading, paginated/infinite list, 3D viewer loaded on demand.
- **Files & limits** (all configurable via env):
  | Limit | Default |
  |---|---|
  | Max model file (STL/3MF) | 250 MB (warning above 50 MB) |
  | Max image | 15 MB (stored re-encoded as WebP, max 2560 px) |
  | Max files per project | 20 |
  | Max images per project | 30 |
  | **Total storage quota** | 20 GB — uploads rejected beyond it; usage bar in Settings |
  Observed sizes: sliced `.gcode.3mf` median 0.7 MB (p90 7 MB, rare outliers up to 175 MB), projects 0.5–2.5 MB, STL < 11 MB. Rough sizing: 100 projects × (4 files × 3 MB + 10 images × 0.5 MB) ≈ **2 GB** → the 20 GB quota leaves ample room.
- MIME/extension validation; uploads streamed to disk (not buffered in memory).
- **No auth**: the app is reachable only through the existing proxy, from home or via VPN.
- **Backups**: two things to back up — the PostgreSQL database (`pg_dump`) and the uploads volume (`/data`). In-app export (ZIP) in v1.x.
- **i18n**: Spanish UI, English-ready.

---

## 7. Architecture & stack

```
┌──────────────────────── Nuxt 4 app (single container) ───────────────────────┐
│  Frontend (Vue 3, Nuxt UI, motion-v, PWA)   Server (Nitro /server/api)        │
│  - pages: home (grid/list),                 - REST endpoints                   │
│    detail, forms, import, catalogue         - importers (makerworld, …)        │
│  - three.js STL/3MF viewer                  - 3MF parser (v1.x)                │
│  - service worker (@vite-pwa/nuxt)          - image processing (sharp)         │
└───────────────┬───────────────────────────────────────┬──────────────────────┘
                │                                       │
  PostgreSQL (existing server)              Uploads on /data volume
  Drizzle ORM · auto migrations · FTS
```

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3 + Nitro) | Front + API in one codebase. |
| UI | **Nuxt UI** + Tailwind | Modern components, tokens, dark mode. |
| Animation | Vue `<Transition>`/`<TransitionGroup>` (CSS, FLIP reordering) + View Transitions API | No extra dependency; `motion-v` was tried and dropped (SSR-rendered items stayed at their `initial` state). |
| PWA | **@vite-pwa/nuxt** | Manifest, service worker, share target. |
| DB | **PostgreSQL + Drizzle ORM** (`node-postgres`) | Reuses the existing server; typed schema in TS; SQL migrations versioned in the repo. |
| Search | Postgres full-text (`tsvector`, `spanish` config + `unaccent`) + `pg_trgm` | Accent-insensitive, typo-tolerant search with no extra service. |
| Files | Local filesystem via **unstorage** | Swap to S3/MinIO later without code changes. |
| Images | **sharp** | Thumbnails + WebP. |
| 3D viewer | **three.js ≥ r174** (STLLoader, 3MFLoader) in a Web Worker | r174+ needed for Bambu split-file 3MF; sliced files have no mesh → show thumbnail. |
| 3MF parsing | **fflate** + **fast-xml-parser**, in a worker thread | Verified: see [research/bambu-3mf.md](research/bambu-3mf.md) and the working prototype. |
| Validation | **zod** | Shared client/server schemas. |
| Testing | Vitest + @nuxt/test-utils, Playwright E2E | |
| Deploy | Multi-stage **Dockerfile** + **docker-compose.yml** | Node LTS slim image, non-root user, healthcheck. |

### Deployment
```yaml
# docker-compose.yml (sketch)
services:
  app:
    image: planificador:latest
    build: .
    restart: unless-stopped
    env_file: .env            # DATABASE_URL, limits, quota…
    volumes:
      - ./data:/data          # uploads (images, models, thumbnails)
    ports:
      - "3000:3000"           # or attach to the proxy's network instead
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
```
- All configuration through environment variables, documented in `.env.example`.
- The image is self-contained so it can be moved to another host as is.
- A `docker-compose.dev.yml` with its own Postgres container for local development, so the project can be resumed on any machine.

### Database setup & migrations

One-time setup on the existing server (documented in `docs/ops/database.md`):
```sql
CREATE ROLE trestero LOGIN PASSWORD '***';
CREATE DATABASE trestero OWNER trestero;
-- pg_trgm and unaccent are "trusted" extensions (PG 13+):
-- the database owner can create them, no superuser needed.
```

Schema evolution is fully owned by the application:
1. The schema is defined in TypeScript (`server/db/schema.ts`).
2. `drizzle-kit generate` produces a **versioned SQL migration** in `server/db/migrations/` that is committed and reviewed.
3. On startup, a Nitro plugin runs `migrate()` inside a **Postgres advisory lock** (safe if two containers start) before serving requests; the applied migrations are tracked in the `__drizzle_migrations` table.
4. A failed migration aborts the startup (container restarts, healthcheck fails) — never a half-migrated app.
5. Rules: migrations are append-only (never edit an applied one); destructive changes go in two steps (add → backfill → remove in a later release); `pg_dump` before deploying a release with migrations (documented in the deploy checklist).
6. `/api/health` reports DB connectivity and the current schema version.

### Data model

```
projects(id, title, description, status, priority, source, source_url,
         designer, license, notes, cover_image_id, final_file_id,
         archived_at, created_at, updated_at)

project_images(id, project_id, path, thumb_path, position, caption)

project_files(id, project_id, kind[model|sliced], format[stl|3mf], path, size, sha256,
              original_name, label, notes, est_minutes, plates, printer_model_id,
              bbox_x, bbox_y, bbox_z, fits_printer, thumbnail_path,
              parsed jsonb,            -- full parser output, for re-mapping
              created_at)
project_file_filaments(file_id, filament_id, grams)

print_logs(id, project_id, file_id, printed_at, result[success|failed|partial],
           minutes, notes)
print_log_filaments(print_log_id, filament_id, grams)
print_log_images(id, print_log_id, path, thumb_path)

tags(id, name, color)
project_tags(project_id, tag_id)

filaments(id, type, brand, color_name, color_hex, price_per_kg)
materials(id, category, name, spec, url)
project_materials(project_id, material_id, quantity)

status_history(id, project_id, from_status, to_status, changed_at)
project_sources(project_id, importer, external_id, url, raw jsonb, imported_at)
settings(key, value)
```

### API sketch
```
GET    /api/projects?q=&tags=&status=&priority=&sort=&page=
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id                    (archive; ?hard=true deletes)
POST   /api/projects/:id/status
POST   /api/projects/:id/images             (multipart)
POST   /api/projects/:id/files              (multipart)
PATCH  /api/projects/:id/files/:fileId      (label, notes, grams, final flag)
POST   /api/projects/:id/prints
PATCH  /api/projects/:id/prints/:printId
POST   /api/import                          { url } → draft (not saved)
GET    /api/tags | /api/filaments | /api/materials   (+ CRUD)
GET    /api/export                          (v1.x)
GET    /api/health
```

---

## 8. Roadmap

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Spike & design** ✅ | MakerWorld import feasibility; Bambu 3MF metadata; UI mockups | Done 2026-11-20 — pending mockup approval and final name |
| **1. Foundations** | Nuxt project, design tokens/theme, Dockerfile + compose, DB schema & migrations, file storage, PWA shell | Container runs behind the proxy; app installable on Android |
| **2. Core** | Project CRUD, gallery, tags, materials catalogue, file iterations + viewer, cost | Manage a project end to end manually |
| **3. Prints & status** | 3MF parsing + fit check, print log, real cost, status workflow + history | Full iteration cycle: upload → print → log → final |
| **4. Discovery** | Grid/list, search, filters, sorting, grouping, bulk actions, motion polish | Find any project in < 3 taps |
| **5. Import** | MakerWorld importer + Android share target | Share link from phone → saved project |
| **6. v1.x** | Backup/export, inventory, shopping list, saved filters | |

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| MakerWorld has **no official public API**; page structure may change; anti-bot protection may block server-side fetches | Import breaks | Importer isolated behind an interface; fallback to manual form pre-filled with the URL |
| Model downloads on MakerWorld require login | No automatic file download | Import metadata + images; user uploads files manually |
| MakerWorld **Terms of Service / licenses** | Legal | Private family use only; always store designer, license and source link; never republish |
| Bambu 3MF format changes between Bambu Studio versions | Auto-extraction fails | Every key optional, values always editable, tested against BS 1.3→2.9 samples |
| Malicious/huge 3MF (zip bomb, path traversal) | DoS / file overwrite | Entry/size caps, never use entry names as paths, parse in a worker thread |
| No authentication | Anyone reaching the URL can edit/delete | Access restricted at the proxy (LAN/VPN/basic auth); soft delete + backups |
| Large files on the mini PC | Disk usage | Upload limits, thumbnails, easy backup/cleanup of archived projects |
| Heavy animations on low-end devices | Janky UI | GPU-friendly transforms only, reduced-motion support, lazy-load 3D viewer |

---

## 10. Open questions

1. ~~**Name**~~ → **3tero** (§1).
2. **Mockups feedback**: approve / adjust the screens in [design/README.md](design/README.md).
3. ~~PostgreSQL version~~ → latest (19); dev uses `postgres:19-alpine`.

---

## 11. Documentation & resumability

Time available will be scarce and irregular, so the repo must be resumable from any machine, by a person or by a coding assistant, without relying on memory:

| File | Purpose |
|---|---|
| `README.md` | What it is, how to run it locally and in production. |
| `CLAUDE.md` | Working rules for coding assistants: where things are, conventions, commands. |
| `docs/PROJECT_PLAN.md` | This document: scope, architecture, roadmap. |
| `docs/STATUS.md` | **Where we are**: current phase, last done, next steps, blockers. Updated at the end of every work session. |
| `docs/adr/NNNN-*.md` | Architecture Decision Records: one short file per decision (context, decision, consequences). |
| `docs/research/` | Spikes: MakerWorld import, Bambu 3MF format. |
| `docs/design/` | Mockups link, design tokens, UI rules. |
| `docs/ops/` | Database setup, deployment, backups (phase 1). |
| `.env.example` | Every configuration variable, commented. |

Practices: small commits with Conventional Commits; each roadmap phase split into small tasks listed in `STATUS.md`; `docker compose -f docker-compose.dev.yml up` is the only command needed to start developing.
