# Summa Vision — Baseline

## Performance & Static Analysis

- **Perf**: `npm run perf:analyze` (bundle), `npm run perf:size` (JS/CSS бюджеты),
  `npm run perf:lhci` (Lighthouse 3x на / и /healthz), `npm run perf:check` (всё вместе).
- **Static Analysis**: `npm run analyze:knip:ci` (мёртвый код/экспорты/зависимости),
  `npm run analyze:cycles` (циклы), `npm run quality:check` (оба шага).
- Первые недели держим Lighthouse-assert’ы как **warn**, потом можно ужесточить до **error** и включить в CI.

## A11y & SEO

- A11y: линтер `jsx-a11y`, unit-проверки через `jest-axe`, e2e-сканы `@axe-core/playwright`. Цвета только через токены CSS.
- SEO: метаданные централизованы в `apps/web/lib/seo.ts`, страницы задают `export const metadata` через `buildMetadata`.
- Robots/Sitemap: `apps/web/app/robots.ts` и `apps/web/app/sitemap.ts`.
- ENV: задайте `NEXT_PUBLIC_SITE_URL` для корректных canonical и sitemap.
- Команды: `npm test`, `npm run a11y:e2e`, `npm run ci:check`.

## Dev / Build / Test

- Dev: `npm run web:dev`
- Build: `npm run web:build` → `npm run web:start`
- Unit/Coverage: `npm run test:ci`
- Quality: `npm run quality:check`
- Perf: `npm run perf:check`
