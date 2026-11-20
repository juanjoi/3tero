# ADR 0005 — MakerWorld import via internal JSON API, metadata only

- Status: accepted · 2026-11-20 — see [research/makerworld.md](../research/makerworld.md)

## Decision
- Pluggable `ProjectImporter` interface; first implementation: MakerWorld.
- Source order: design-service JSON API → `__NEXT_DATA__` from HTML → Open Graph → manual form.
- Imports metadata, images (copied locally) and print profiles; **model files are uploaded manually** (downloads require login).
- User-triggered only, raw JSON stored, never bypass anti-bot measures, private use.

## Consequences
- Fragile by nature (undocumented API): defensive parsing and fallbacks are mandatory.
