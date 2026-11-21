# Working on this repo

Read first, in order: `docs/STATUS.md` (where we are), `docs/PROJECT_PLAN.md` (scope & architecture), `docs/adr/` (decisions — don't contradict them without writing a new ADR).

## Rules
- Code, comments, commits and docs in English; UI copy in Spanish (i18n keys).
- Conventional Commits, small and focused.
- Schema changes only through Drizzle: edit `server/db/schema.ts` → `drizzle-kit generate` → commit the SQL migration. Never edit an applied migration.
- Every new config value goes to `.env.example` with a comment.
- External importers live behind the `ProjectImporter` interface; never bypass anti-bot protections.
- Respect design tokens in `docs/design/README.md`; animations via transforms/opacity, honour reduced motion.
- No popups (modals, slide-overs, dropdown menus): inline panels, dedicated pages and `ConfirmButton` — ADR 0006.
- At the end of a work session, update `docs/STATUS.md` (done / next / blockers).

## Commands
- Dev: `docker compose -f docker-compose.dev.yml up -d --wait && npm run dev`
- Schema change: edit `server/db/schema.ts` → `npm run db:generate`
- Checks: `npm run typecheck`, `npm test`, `docker build -t trestero:latest .`
- Release: tag `vX.Y.Z` on `main` and push the tag → CI publishes `ghcr.io/juanjoi/3tero:X.Y.Z`.
