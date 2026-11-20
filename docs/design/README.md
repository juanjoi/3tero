# Design

## Mockups
Interactive canvas (private link, owner only): https://claude.ai/artifact/L6knFcGbyedNiqtCLEvv9i

| Screen | Device | Notes |
|---|---|---|
| Home | Phone 390×844 | Search, status chips (interactive filter), 2-column cards, FAB, bottom nav |
| Project detail | Phone | Hero gallery, priority + tags, status stepper, KPIs (cost/grams/time), primary action "Log print", tabs Files / Prints / Materials / Notes (interactive) |
| Log print | Phone (bottom sheet) | File used, result, grams per filament pre-filled from 3MF, photo, real time, "mark as printed + final" |
| Import | Phone | Shared URL, step progress, images, title, **profile picker with A1 mini preselected**, tags, attribution |
| Board | Tablet landscape 1194×834 | Side nav with tags + storage usage, 3 kanban columns, drag state |

Source of the mockups (HTML) is kept in `docs/design/mockups/`.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F5F7F5` | app background |
| `--surface` | `#FFFFFF` | cards, sheets |
| `--ink` | `#0F1712` | main text |
| `--muted` | `#56635B` | secondary text (≥ 4.5:1 on white) |
| `--border` | `#E1E6E2` | borders |
| `--accent` | `#15803D` | primary buttons, active states (white text AA) |
| `--accent-soft` | `#DDF4E4` | selected backgrounds |
| `--status-modeling` | `#1D4ED8` | |
| `--status-sliced` | `#6D28D9` | |
| `--status-printed` | `#15803D` | |
| `--prio-high / medium / low` | `#EA580C` / `#EAB308` / `#94A3B8` | dots, always paired with a label |

- Fonts: **Space Grotesk** (headings, numbers) + **Inter** (body).
- Radius: 12 (controls) · 16–18 (cards) · 24 (sheets).
- Touch targets ≥ 44 px. Dark mode: to be derived from these tokens in phase 1.

## Motion rules
See PROJECT_PLAN §5.3. Use transforms/opacity only; respect `prefers-reduced-motion`.
