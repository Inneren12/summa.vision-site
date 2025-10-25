# Contributing Guide: Flags & Rollouts

> Документ для инженеров, которые добавляют или обновляют флаги. Дополняет `docs/flags.md`, `docs/segments.md` и `docs/rollouts.md`.

## 1. Соглашения по именованию

- Используем `lowerCamelCase` (`betaUI`, `newCheckout`, `checkoutV2`).
- Префикс по продуктовой зоне: `billing*`, `cms*`, `nav*`. Для экспериментов добавляйте версию (`experimentFoo_v2`).
- Не используйте дефисы/пробелы; JSON ключи дублируют `FLAG_REGISTRY[name]`.
- Для флагов безопасности добавляйте суффикс `Guard`/`Kill` (`checkoutKillSwitch`). Они часто привязаны к `ignoreOverrides`.
- В описании (`description`) первым предложением указывайте действие («Enable ...», «Rollout ...»), вторым — контекст/платформа при необходимости.

## 2. Теги (`tags[]`)

Теги помогают фильтровать флаги и сегменты (см. `FlagConfig.tags` и `SegmentCondition` с `field:"tag"`). Рекомендуемые префиксы:

| Префикс | Назначение | Пример |
| --- | --- | --- |
| `team:` | владелец/поддерживающая команда | `team:design` |
| `product:` | крупный модуль | `product:checkout` |
| `risk:` | уровень риска (для SLO/TTR) | `risk:high` |
| `env:` | ограничения окружения | `env:edge-only` |

- Используйте минимум один тег `team:*` для автоматизации ответственности.
- Теги наследуются сегментами через `conditions` (`{ "field": "tag", "op": "eq", "value": "risk:high" }`).
- В отчётах (`FF().metrics.summarize`) теги помогают строить срезы по командам.

## 3. Семантика `seedBy` и `seedByDefault`

`seedBy` определяет источник случайности (см. `lib/ff/runtime/types.ts#SeedBy`).

| Значение | Использовать когда | Источник |
| --- | --- | --- |
| `stableId` | авторизованные пользователи, нужен стабильный rollout | `ctx.stableId` (user/session) |
| `userId` | требуется строгая привязка к ID пользователя | `ctx.userId` (throw, если отсутствует) |
| `anonId` | анонимный трафик с cookie `sv_id` | `ctx.cookieId` |
| `cookie` | кастомная cookie из контекста | `ctx.cookieId` (raw) |
| `namespace` | сегментация по tenant/пространству | `ctx.namespace` |
| `ipUa` | короткоживущие кампании (по IP+UA) | `hash(ip + ua)` |
| `user` | устаревшее псевдоним для `userId` (используем только для обратной совместимости) |

- В реестре (`FLAG_REGISTRY`) указывайте `defaultValue.seedByDefault`, если rollout требует нестандартного источника.
- Сегменты могут переопределить `seedBy` в `rollout` блоке. Если не указать, берётся `seedByDefault`.
- Изменение `seedBy` → перерасчёт корзин. Перед правкой согласуйте с продуктом/данными.

## 4. Правила для сегментов

Сегменты (`SegmentConfig`) задают таргетинг (см. `docs/segments.md`).

- `id`: уникальный, человекочитаемый (`tenant:summa`, `locale:pt-BR`).
- `priority`: чем выше, тем раньше применяется. Рекомендуемая шкала:
  - `1000+` — аварийные overrides (SRE/Sec).
  - `500` — продуктовые сегменты (тенанты, партнёры).
  - `100` — локализация/UX дорожки.
  - `0` — fallback.
- `conditions`: массив предикатов. Для tenant'ов используйте `field:"namespace"`, для UA — `field:"ua"`. Для комбинаций используйте несколько условий (AND).
- `override`: булево/значение. Если указано, rollout внутри сегмента игнорируется.
- `rollout`: локальная стратегия (percent/salt/seedBy/steps). При указании `percent<100` обязательно документируйте в policy (см. `docs/rollouts.md`).
- `ttlSec`: не поддерживается на сегментах (используйте overrides).

### Типовой сегмент

```json
{
  "id": "tenant:summa",
  "name": "Summa beta",
  "priority": 500,
  "conditions": [{ "field": "namespace", "op": "eq", "value": "summa" }],
  "rollout": { "percent": 100, "seedBy": "stableId" }
}
```

### Сегмент с override

```json
{
  "id": "risk:high",
  "priority": 1200,
  "conditions": [{ "field": "tag", "op": "eq", "value": "risk:high" }],
  "override": false,
  "name": "Emergency shutdown"
}
```

## 5. Обязательные проверки перед PR

- `npm run ff:codegen` — обновляет типы и `docs/flags.generated.md`.
- `npm run ff:doctor` / `npm run ff:doctor:strict` — проверяет референсы в коде.
- Обновите `docs/flags.md` (если меняется семантика) и `docs/rollouts.md` (если появляются новые политики).
- При добавлении новых тегов — отразите их в этой странице (секция 2).
- Если меняется `seedBy`/`segments`, приложите dry-run отчёт в PR (вывод `scripts/ff-rollout.mjs --dry-run`).

## 6. Быстрые шпаргалки

```bash
# Генерация типов и инвентаризации
npm run ff:codegen

# Проверка использования флагов
npm run ff:doctor:strict

# Экспорт снапшота перед рисковыми правками
node scripts/ff-snapshot.mjs export ./snapshot.json --host=http://localhost:3000
```

> Любое изменение поведения флагов должно сопровождаться обновлением релевантных docs (`ops-playbook`, `rollouts`, `flags`).
