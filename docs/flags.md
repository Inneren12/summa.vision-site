# Feature flag definitions

Эта страница описывает практику работы с конфигурацией флагов в репозитории. Она дополняет `docs/feature-flags.md`, `docs/FLAGS_PLAYBOOK.md` и ссылается на runtime-реализацию из `lib/ff/`.

## Создание нового флага

1. Добавьте запись в `lib/ff/flags.ts`. Обязательно заполните поля `description`, `owner`, `type` и (если есть sunset) `sunsetDate`.
2. Выполните `npm run ff:codegen`, чтобы обновить типы (`types/flags.generated.d.ts`) и инвентаризацию (`docs/flags.generated.md`).
3. Определите начальное значение и rollout в файле `FEATURE_FLAGS_JSON` (локально) или через admin-консоль.
4. Пройдите `npm run ff:doctor[:strict]` и убедитесь, что новый флаг попал в отчёт без предупреждений.

## Структура `FlagConfig`

`FlagConfig` описан в `lib/ff/runtime/types.ts` и содержит ключевые поля:

- `key`, `namespace`, `description`, `tags` – метаданные.
- `enabled` + `defaultValue` – базовое состояние.
- `seedByDefault` – предустановленный алгоритм семплирования (`stableId`, `anonId`, `user`, `userId`, `namespace`, `cookie`, `ipUa`).
- `rollout` – стратегия по умолчанию (см. [docs/rollouts.md](./rollouts.md)).
- `segments` – сегменты с приоритетами (см. [docs/segments.md](./segments.md)).
- `createdAt`/`updatedAt` – таймстемпы, которые **обязательно** обновлять при ручном редактировании снапшота.
- `kill`/`killSwitch` – экстренное отключение. Для булевых флагов kill всегда возвращает `false`. Для строковых/числовых
  флагов используется `killValue`, а если оно не задано – рантайм вернёт `undefined` и вызывающий код обязан трактовать это
  как «выключено».

## Сегменты и seedBy

- `seedBy` в сегменте или глобальном rollout выбирает источник случайности. Используйте `stableId` для user-based сегментации; `anonId`/`cookie` – для анонимного трафика; `ipUa` – крайний случай (нестабилен).
- `seedByDefault` применяется, если сегмент не задаёт `rollout.seedBy`. Это позволяет менять глобальную стратегию без пересоздания сегментов.
- Для тестирования deterministic-раздач предпочтителен `seedBy: "stableId"` + фиксированный `salt`.

## Сегменты и overrides

Каждый сегмент (`SegmentConfig`) имеет `priority`. Более высокое значение перезаписывает решения низкого приоритета. Если `override` указан, сегмент полностью заменяет rollout и возвращает указанное значение.

Рекомендуемая шкала приоритетов:

| Priority | Назначение                    |
|---------:|------------------------------|
| `1000+`  | Экстренные overrides (SRE)   |
| `500`    | Продуктовые сегменты (tenant) |
| `100`    | Локализация/дорожки (locale) |
| `0`      | Базовая аудитория            |

## Подготовка seedBy/segments в JSON

В локальном `FEATURE_FLAGS_JSON`

```json
{
  "betaUI": {
    "enabled": true,
    "percent": 5,
    "seedBy": "stableId",
    "segments": [
      {
        "id": "tenant:summa",
        "priority": 500,
        "conditions": [{ "field": "namespace", "op": "eq", "value": "summa" }],
        "override": true
      }
    ]
  }
}
```

После изменения ENV запустите `npm run ff:reload` (см. ниже), чтобы dev-сервер перечитал настройки без рестарта.

## Dev-клипы

- `/api/dev/ff-reload` выполняет `__resetEnvCache()` и возвращает `404`, если `NEXT_PUBLIC_DEV_TOOLS !== "true"`.
- Состояние рантайма можно сохранить и восстановить через `scripts/ff-snapshot.mjs` (см. [docs/rollouts.md](./rollouts.md#снапшоты-и-откаты)).
- Для срочного отключения фич используйте переменные `FF_KILL_ALL=true` или `FF_FREEZE_OVERRIDES=true` (см. [docs/rollouts.md](./rollouts.md#экстренные-тумблеры)).

