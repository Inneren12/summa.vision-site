# Сегменты и предикаты

Сегменты позволяют таргетировать rollout на подмножество аудитории. Структура определяется типом `SegmentConfig` (`lib/ff/runtime/types.ts`).

## Предикаты

`SegmentRule.where` — массив условий, объединённых по `AND`. Сложные `OR`-комбинации пока не поддерживаются.

| Тип | Поля | Операторы | Примечание |
| --- | --- | --- | --- |
| Строки | `namespace`, `user`, `cookie`, `ip`, произвольные атрибуты из `ctx.attributes` | `eq`, `startsWith`, `contains`, `in`, `notIn` | `in`/`notIn` принимают массив строк |
| Теги | `tag` | `eq`, `in`, `notIn`, `contains`, `startsWith` | Сравнение идёт по `ctx.tags` |
| User-Agent | `ua` | `contains` | Проверяется `ctx.userAgent` |
| Путь | `path` | `glob` | Поддерживаются маски `*` и `?`, совпадение идёт по `ctx.path` |
| Числа | произвольные числовые атрибуты (`ctx.attributes`) | `eq`, `gt`, `lt`, `between` | `between` включает границы |

Примеры:

```json
{
  "id": "tenant:summa",
  "priority": 500,
  "where": [{ "field": "namespace", "op": "eq", "value": "summa" }],
  "rollout": { "percent": 100 }
}
```

```json
{
  "id": "ua:safari",
  "priority": 200,
  "where": [
    { "field": "ua", "op": "contains", "value": "Safari" },
    { "field": "path", "op": "glob", "value": "/checkout/*" }
  ],
  "override": false
}
```

## Приоритеты

Сегменты сортируются по возрастанию `priority`, далее выполняется стратегия «первый матч» — как только условие выполнено, остальные сегменты не проверяются. При равных значениях сохраняется порядок элементов в массиве.

| Диапазон `priority` | Назначение |
| --- | --- |
| `>= 1000` | Ручные overrides, которые должны перекрывать всё |
| `500–999` | Основные бизнес-сегменты (тенанты, партнёры) |
| `100–499` | Поведенческие дорожки, локализация |
| `0–99` | Fallback и эксперименты по умолчанию |

## Rollout внутри сегмента

Сегмент может содержать собственный `rollout`:

- `percent` — доля аудитории внутри сегмента.
- `salt` — строка, которая влияет на хеш (меняйте при «reshuffle»).
- `seedBy` — источник случайности (`stableId`, `anonId`, `user`, `userId`, `cookie`, `ipUa`). Если не указано, используется `seedByDefault` флага.
- `steps` — локальные шаги раскатки (список `pct`/`note`/`at`).
- `stop` и `hysteresis` — аналогично глобальному rollout (см. [docs/rollouts.md](./rollouts.md)).

## Namespace/locale/path/UA

- Namespace (tenant) приходит из `FFContext.namespace`. Для Next.js SSR см. `lib/ff/server.ts#getFeatureFlagsFromHeaders`.
- Путь (`path`) прокидывается в `FFContext.path`. Для сложных шаблонов используйте `op: "glob"`.
- Locale и другие признаки можно передавать через `ctx.tags` или `ctx.attributes` и обрабатывать через `tag`/произвольные поля.
- User-Agent (`ua`) доступен только на сервере — для client-side нужно прокидывать признак отдельно.

## SeedBy best practices

- **StableId** — дефолт для авторизованных пользователей.
- **AnonId** или **cookie** — анонимный трафик (middleware ставит куку `sv_flags_override`).
- **ipUa** — только для коротких экспериментов (пользователь может сменить IP/UA).

