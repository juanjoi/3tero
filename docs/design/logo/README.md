# Logo — 3tero

Chosen 2026-11-21 (option "C v3 · Estantería con D" of the logo exploration canvas).

- **Idea**: the "3" of *3tero* (read "trastero", a storage room) is a shelf with three printed parts on it:
  a cube (top), a letter **D** (middle, orange → the symbol reads "3D") and a cone (bottom).
- **Wordmark**: the symbol *is* the "3": `[symbol]tero`, Space Grotesk Bold, optional tagline "PROYECTOS 3D".
- **Colours**: shelf `#15803D` (dark mode `#4ADE80`), parts `#22C55E` (`#86EFAC`), D `#F97316` (`#FB923C`).
  App icon: white shelf on `#15803D`, parts `#BBF7D0`, D `#FDBA74`.

| File | Use |
|---|---|
| `symbol.svg` | colour symbol, transparent background (docs, README) |
| `app-icon.svg` | = `public/logo.svg`, source of the PWA icons and favicon |
| `app/components/AppLogo.vue` | in-app logo (inline SVG, follows light/dark theme) |

## Changing it (e.g. a bigger D)

The D is one path. The "big D" variant that was also considered:
`M57 37 H64.5 A8.75 8.75 0 0 1 64.5 54.5 H57 Z M61 41 V50.5 H64.5 A4.75 4.75 0 0 0 64.5 41 Z`.

1. Replace the D path in `public/logo.svg`, `docs/design/logo/*.svg` and `app/components/AppLogo.vue`.
2. `npm run pwa:assets` to regenerate favicon / PWA icons.
