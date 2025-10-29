# Dashboards (каркас)

## Как создать новый дашборд

1. Создайте страницу: `app/(dashboards)/<slug>/page.tsx`
2. Используйте `<DashLayout filters={<FilterPanel/>}>` и внутри `<VizWidget/>`, `<DataTable/>`
3. Состояние фильтров синхронизируется с URL через `useDashState`

## Фильтры и URL

- `?f[country]=CA&f[sector]=AI&f[sector]=Energy`
- Пресет: `?preset=<base64>`

## Данные

- Получайте через `useDashDataset(slug, filters)` (SWR), `keepPreviousData:true`

## Виджеты

- `<VizWidget lib="vega-lite" spec={...} data={...} />`
- Либы подгружаются динамически, не кладите импортов на верхнем уровне

## Таблица

- `<DataTable rows={data.items} />` (TanStack Table)

## Freshness

- `FreshnessBanner` покажет устаревание при превышении threshold

## Тесты

- Vitest: схема/URL
- Playwright: фильтры → URL, пресеты/шаринг
