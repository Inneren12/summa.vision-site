# Brand Token Reference

The canonical token source lives in `tokens/brand.tokens.json` and compiles to CSS (`styles/tokens.css`) and TypeScript (`src/shared/theme/tokens.ts`). This document summarizes the semantic layers without embedding raw color codes.

## Color Layers

### Palette
- `color.brand.blue.050–900` — Brand ramp anchored on `color.brand.blue.500` (logo blue).
- `color.neutral.000–950` — Neutral grayscale for backgrounds, borders, and typography.
- `color.accent.*` — Supporting accents for infographics and emphasis.
- `color.status.*` — Base hues for success, warning, alert, and informational states.

### UI Tokens
- `color.bg.canvas` — Default page background.
- `color.bg.surface` — Card surfaces and inset sections.
- `color.bg.elevated` — Layered panels and overlays.
- `color.fg.default` / `color.fg.muted` / `color.fg.subtle` — Primary, muted, and supportive text.
- `color.border.subtle` / `color.border.default` / `color.border.emphasis` — Divider hierarchy.
- `color.statusSurface.<state>.{fg,bg,border}` — Accessible alert combinations.

### Data Visualization
- `color.series.1–12` — Ordered categorical palette; follow numeric sequence.
- `color.grid.major` / `color.grid.minor` — Major/minor gridlines for charts.

## Typography
- Families: `font.family.sans`, `font.family.mono`.
- Sizes: `font.size.display` through `font.size.caption`.
- Line heights: `font.lineHeight.tight|snug|normal|relaxed`.
- Weights: `font.weight.regular|medium|semibold|bold`.

Use `styles/typography.css` for ready-made classnames (e.g., `.typography-h1`).

## Spacing & Layout
- `space.0` = 0px, `space.1` = 4px up to `space.10` = 48px (8pt grid).
- Radius scale: `radius.xs` (2px) through `radius.2xl` (24px) and `radius.full`.
- Shadows: `shadow.z1` (cards), `shadow.z2` (sticky headers), `shadow.z3` (modal depth).
- Motion: `motion.duration.fast|base|gentle`, `motion.easing.cubic|emphasized|entrance|exit`.

## Usage Reminders
- Reference semantic tokens (`color.bg.canvas`) rather than palette literals in product code.
- Always regenerate compiled artifacts via `npm run build:tokens` after editing the JSON source.
- Run `npm run lint:no-raw-colors` to prevent raw HEX/RGB strings from leaking into CSS/TS.
- Document token changes in pull request notes to keep downstream consumers aligned.
