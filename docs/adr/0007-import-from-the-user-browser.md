# ADR 0007 — Import from the user's browser when the platform challenges the server

- Status: accepted · 2026-11-22 · extends [ADR 0005](0005-makerworld-import-strategy.md)

## Context
In production (mini PC), MakerWorld answers the server's requests, including the design JSON API,
with a Cloudflare challenge (`403`, `cf-mitigated: challenge`). From other networks the same API
answers normally, so it depends on the server's IP and client, not on our code. ADR 0005 forbids
bypassing anti-bot measures: no browser impersonation (TLS fingerprints, headless browsers,
challenge solvers) and no tuning the client to look less like a server.

The 3tero page itself cannot read MakerWorld from the browser either: the API sends no CORS
headers, and a server-side proxy would leave from the challenged IP again.

## Decision
When the server is challenged, the **user's browser** reads the data on MakerWorld, where it has
passed the check as a person, and hands the raw design JSON to 3tero, which builds the draft with
the same code as before (`mapDesign`, allow-listed image download, profiles, BOM):

- **Bookmarklet "3tero"** (Ajustes → install it): on a MakerWorld model page it fetches the design
  API same-origin and submits a top-level form POST to `/import/browser`, which caches the draft and
  redirects to the review page. Errors are posted too and shown inline in 3tero. Works on desktop and
  on Chrome for Android (typing the bookmark name in the address bar).
- **Paste data**: the import error offers a link to the raw design JSON; the user opens it, copies
  everything and pastes it in `/import`.
- Importers opt in through `ProjectImporter.fromPayload` (validates the data belongs to the URL) and
  `rawDataUrl`. The server fetch stays the first attempt; drafts from the browser are marked
  `via: 'browser'`.

A browser extension was considered: comfortable on desktop, but Chrome for Android has no extensions
and Firefox for Android needs it published on addons.mozilla.org. It can reuse `/import/browser`
later if the bookmarklet feels clumsy on desktop.

## Consequences
- Imports work again from the mini PC without bypassing anything: one more tap than sharing a link.
- Sharing from the MakerWorld app still lands in `/import` with a link only; when the server is
  challenged the user continues with the bookmarklet or by pasting.
- `/import/browser` accepts cross-site form posts (no auth, ADR 0003). It only fills the short-lived
  draft cache with data that must match the model URL; saving still needs the user's review.
- If MakerWorld's page CSP ever blocks the form post (`form-action`), or 3tero is served over plain
  HTTP (Chrome warns before sending a form from HTTPS to HTTP), pasting still works.
