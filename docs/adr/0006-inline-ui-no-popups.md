# ADR 0006 — Inline UI, no popups

- Status: accepted · 2026-11-21

## Context
The family uses the app mostly on Android phones. Modal dialogs, slide-overs and dropdown menus were
awkward there (small targets, hidden actions, back button closing the page instead of the dialog) and
the owner explicitly asked to avoid popups. A technical issue reinforced it: components mounted later
inside dialogs with top-level `await useFetch` never rendered.

## Decision
No modals, slide-overs or dropdown menus for actions:
- **Inline expanding panels** (`<Transition name="expand">`) for editing in place: catalogue forms,
  file rows (actions bar, 3D viewer, data editor), project options panel.
- **Dedicated pages** for longer flows: `/projects/:id/print` (log a print), `/import`.
- **`ConfirmButton`** (two taps within 4 s) instead of confirmation dialogs for destructive actions.
- Fullscreen 3D viewer through the browser **Fullscreen API**, not a modal.
- Toasts are allowed (non-blocking feedback). Form selects (`USelect`) remain for compact choices.

## Consequences
- Every action is visible where the data is; the Android back button behaves as expected.
- Pages grow a bit longer; sticky bottom bars keep the main action reachable.
- New UI work must follow this ADR (also noted in `docs/STATUS.md` gotchas).
