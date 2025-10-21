# Summa Vision Brand System

This repository houses the brand design tokens, typography system, OG templates, and supporting documentation for Summa Vision.

## Getting Started

```bash
npm install
npm run build:tokens
```

- `tokens/brand.tokens.json` — single source of truth for tokens.
- `styles/tokens.css` — generated CSS custom properties (`:root`).
- `styles/typography.css` — base typography and utility classes.
- `src/shared/theme/tokens.ts` — generated token map for TypeScript projects.

## Scripts

| Command | Description |
| --- | --- |
| `npm run build:tokens` | Generate CSS/TS artifacts from `tokens/brand.tokens.json`. |
| `npm run lint:no-raw-colors` | Fail if raw HEX/RGB literals exist outside token sources. |
| `npm run test:axe` | Run axe-core accessibility checks against OG templates (requires Playwright browsers; install via `npx playwright install`). |

## Documentation
- `brand/BRAND_GUIDE.md` — logo usage, palette, typography, spacing.
- `brand/USAGE.md` — how to consume tokens in CSS/TS.
- `brand/NARRATIVE.md` — narrative and tone guidance.
- `brand/og-guidelines.md` — OG layout and export tips.

## OG Rendering
Generate social images via Playwright:

```bash
npx playwright install  # first-time setup
npm run build:tokens
npx tsx scripts/og-render.ts --template chart --theme dark --data '{"title":"Night ridership up","subtitle":"+14% after pilot"}' --out ./dist/chart.png
```

The renderer fills `[data-slot]` placeholders in `og/templates/*.html` and captures a 1200×630 PNG using the shared token theme.
