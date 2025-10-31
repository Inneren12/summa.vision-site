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
- Playwright setup tips: [docs/dev/e2e.md](docs/dev/e2e.md)

## Visual snapshots (S1‑I)

Визуальные тесты вынесены в отдельный конфиг, чтобы не ломать общий E2E/CI.

**Локальный первый запуск (создание базовых PNG):**

```bash
# 1) Собрать приложение (standalone)
npm run web:build

# 2) Установить браузер для раннера проекта
npm run visual:browsers

# 3) Обновить снепшоты (создаст PNG):
npm run test:visual:update
```

Снимки пишутся рядом с тестами:

```
e2e/visual/home.spec.ts-snapshots/home-<os>.png
e2e/visual/healthz.spec.ts-snapshots/healthz-<os>.png
e2e/visual/atoms.spec.ts-snapshots/atoms-<os>.png
```

**Коммит PNG baseline** сделай вручную после первого прогона.

**Обычная проверка без обновления:**

```bash
npm run test:visual
```

> Примечание: мы не меняем CI и не добавляем workflow. Визуальные тесты не участвуют в общем гейте и не падают при отсутствии PNG.

## A11y & SEO

- A11y: линтер `jsx-a11y`, unit-проверки через `jest-axe`, e2e-сканы `@axe-core/playwright`. Цвета только через токены CSS.
- SEO: метаданные централизованы в `apps/web/lib/seo.ts`, страницы задают `export const metadata` через `buildMetadata`.
- Robots/Sitemap: `apps/web/app/robots.ts` и `apps/web/app/sitemap.ts`.
- ENV: задайте `NEXT_PUBLIC_SITE_URL` для корректных canonical и sitemap.
- Команды: `npm test`, `npm run a11y:e2e`, `npm run ci:check`.

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

### Feature Flags

Документация и гайды по фиче‑флагам:

- `docs/FLAGS_PLAYBOOK.md` — основной плейбук раскатки
- `docs/FLAGS_SECURITY_PRIVACY.md` — безопасность и приватность
- `docs/FLAGS_TROUBLESHOOTING.md` — отладка и FAQ
- `docs/FLAGS_GOVERNANCE.md` — правила владения и жизненный цикл
- `docs/FLAGS_API_REFERENCE.md` — справочник API
- `docs/flags.generated.md` — инвентарь флагов (генерируется)

## OG Rendering

Generate social images via Playwright:

```bash
npx playwright install  # first-time setup
npm run build:tokens
npx tsx scripts/og-render.ts --template chart --theme dark --data '{"title":"Night ridership up","subtitle":"+14% after pilot"}' --out ./dist/chart.png
```

The renderer fills `[data-slot]` placeholders in `og/templates/*.html` and captures a 1200×630 PNG using the shared token theme.

## Release & Ops

- Автоверсии/CHANGELOG: GitHub Actions **Release Please**.
- Старт вручную: _Actions → Release Please → Run workflow_.
- Автозапуск: на `push` в `main`.
- Версии/ChangeLog для `apps/web` формируются из Conventional Commits (commitlint уже включён).
