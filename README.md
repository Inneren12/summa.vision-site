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

- `tokens/brand.tokens.json` — single source of truth for tokens.
- `styles/tokens.css` — generated CSS custom properties (`:root`).
- `styles/typography.css` — base typography and utility classes.
- `src/shared/theme/tokens.ts` — generated token map for TypeScript projects.

## Тема и токены

- Провайдер темы: `apps/web/app/providers.tsx` использует `next-themes` с `attribute="class"` и системным значением по умолчанию.
- CSS-переменные и базовые стили подключаются в `apps/web/app/globals.css` (сюда копируются токены и типографика).
- Запустить Storybook с атомами и переключателем темы: `npm run storybook`.

## Tests & QA

- Unit: `npm test` / CI: `npm run test:ci`
- E2E: `npx playwright install --with-deps` (один раз) → `npm run e2e`
- Full gate: `CI=1 npm run ci:check`

## Performance & Static Analysis

- **Perf**: `npm run perf:analyze` (bundle), `npm run perf:size` (JS/CSS budgets),
  `npm run perf:lhci` (Lighthouse 3x на / и /healthz), `npm run perf:check` (всё вместе).
- **Static Analysis**: `npm run analyze:knip:ci` (мертвый код/экспорты/зависимости),
  `npm run analyze:cycles` (циклы), `npm run quality:check` (оба шага).
- Первые недели держим Lighthouse-assert’ы как **warn**, затем можно перевести в **error** и добавить в CI.

## Security & Observability

- Заголовки безопасности и CSP собираются в `apps/web/security/*` и подключаются через `apps/web/next.config.mjs`.
- В development `script-src` допускает `'unsafe-eval'`, в production — нет.
- Чтобы включить отчёты CSP, установите `CSP_REPORT_ONLY=1` и используйте endpoint `POST /api/csp-report`.
- Интеграция Sentry активируется при наличии `SENTRY_DSN`; настройте `SENTRY_ENV` и `SENTRY_TRACES_SAMPLE_RATE` при необходимости.
- В бою рекомендуем отключить режим Report-Only и использовать полноценный `Content-Security-Policy`.

## Тема и токены

- Актуальные CSS-переменные копируются в `apps/web/app/tokens.css` и подключаются через `apps/web/app/globals.css`.
- Tailwind использует токены через форму `rgb` c выражением `var(--token) / <alpha-value>` — см. `apps/web/tailwind.config.ts`.
- Светлая/тёмная темы переключаются компонентом `ThemeToggle` (поставляется из `apps/web/components`).
- Storybook с примерами атомов и тем запускается командой `npm run storybook`.

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
