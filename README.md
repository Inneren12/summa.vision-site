# Summa Vision Brand System

This repository houses the brand design tokens, typography system, OG templates, and supporting documentation for Summa Vision.

## Getting Started

```bash
npm install
npm run build:tokens
```

## Dev (web)

```bash
npm run web:dev
```

## Build

```bash
npm run web:build && npm run web:start
```

## Tokens

```bash
npm run build:tokens && npm run copy:tokens
```

## Tests

```bash
npm test
```

## Тема и токены

- Актуальные CSS-переменные копируются в `apps/web/app/tokens.css` и подключаются через `apps/web/app/globals.css`.
- Tailwind использует токены через форму `rgb` c выражением `var(--token) / <alpha-value>` — см. `apps/web/tailwind.config.ts`.
- Светлая/тёмная темы переключаются компонентом `ThemeToggle` (поставляется из `apps/web/components`).
- Storybook с примерами атомов и тем запускается командой `npm run storybook`.

## Quality Gate

```bash
npm run ci:check
```

Runs type-checks, linting (including the raw color guard), unit tests, and the Next.js production build.

- `tokens/brand.tokens.json` — single source of truth for tokens.
- `styles/tokens.css` — generated CSS custom properties (`:root`).
- `styles/typography.css` — base typography and utility classes.
- `src/shared/theme/tokens.ts` — generated token map for TypeScript projects.

## Scripts

| Command                      | Description                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:tokens`       | Generate CSS/TS artifacts from `tokens/brand.tokens.json`.                                                                   |
| `npm run lint:no-raw-colors` | Fail if raw HEX/RGB literals exist outside token sources.                                                                    |
| `npm run test:axe`           | Run axe-core accessibility checks against OG templates (requires Playwright browsers; install via `npx playwright install`). |

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
