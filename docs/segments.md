# Сегменты и предикаты

Сегменты позволяют таргетировать rollout на подмножество аудитории. Структура определяется типом `SegmentConfig` (`lib/ff/runtime/types.ts`).

## Предикаты

Поддерживаются предикаты по полям:

- `tenant`/`namespace` — сравнивается с `ctx.namespace` (см. `lib/ff/runtime/types.ts#FlagEvaluationContext`).
- `locale`/`path`/`ua` — пишутся через поле `conditions` с `field`=`namespace`/`cookie`/`ua` и оператором `eq`.
- `tag` — проверяет `ctx.tags`.

Примеры:

```json
{
  "id": "tenant:summa",
  "priority": 500,
  "conditions": [{ "field": "namespace", "op": "eq", "value": "summa" }],
  "rollout": { "percent": 100 }
}
```

```json
{
  "id": "ua:safari",
  "priority": 200,
  "conditions": [{ "field": "ua", "op": "eq", "value": "Safari" }],
  "override": false
}
```

## Приоритеты

Сегменты применяются в порядке убывания `priority`. При равных значениях выигрывает первый по порядку в массиве.

- `priority >= 1000` — ручные overrides, которые должны перекрывать всё.
- `priority 500` — основные бизнес-сегменты (тенанты, партнёры).
- `priority 100` — поведенческие дорожки, локализация.
- `priority 0` — fallback (по умолчанию).

## Rollout внутри сегмента

Сегмент может содержать собственный `rollout`:

- `percent` — доля аудитории внутри сегмента.
- `salt` — строка, которая влияет на хеш (меняйте при «reshuffle»).
- `seedBy` — источник случайности (`stableId`, `anonId`, `user`, `userId`, `cookie`, `ipUa`). Если не указано, используется `seedByDefault` флага.
- `steps` — локальные шаги раскатки (список `pct`/`note`/`at`).
- `stop` и `hysteresis` — аналогично глобальному rollout (см. [docs/rollouts.md](./rollouts.md)).

## Namespace/locale/path/UA

- Namespace (tenant) приходит из `FFContext.namespace`. Для Next.js SSR см. `lib/ff/server.ts#getFeatureFlagsFromHeaders`.
- Locale/path передаются как теги на уровне middleware или приложения; используйте `ctx.tags`.
- User-Agent (`ua`) доступен только на сервере — для client-side нужно прокидывать признак отдельно.

## SeedBy best practices

- **StableId** — дефолт для авторизованных пользователей.
- **AnonId** или **cookie** — анонимный трафик (middleware ставит куку `sv_flags_override`).
- **ipUa** — только для коротких экспериментов (пользователь может сменить IP/UA).

