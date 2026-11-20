# ADR 0004 — Files on a mounted volume, with configurable limits and quota

- Status: accepted · 2026-11-20

## Context
< 100 projects short term, STL/3MF (sliced `.gcode.3mf` can be large) and photos. The owner wants a hard limit.

## Decision
- Files stored under `/data` (Docker volume) through `unstorage`, so S3-compatible storage can be added later.
- Database stores metadata only (path, size, hash, mime).
- Limits via env: max model file, max image, files/images per project, total quota. Usage shown in Settings.
- Images re-encoded to WebP (max 2560 px) + thumbnails with `sharp`.

## Consequences
- Backups = `pg_dump` + copy of `/data`.
- Quota checks on every upload (sum of `size` in DB).
