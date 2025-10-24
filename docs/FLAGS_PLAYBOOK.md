# Flags Playbook (S4G)

> Цель: безопасная инкрементальная раскатка фич, управление конфигурацией,
> предсказуемость на SSR/CSR, быстрый откат и отсутствие рассинхронов.

## 1. Модель флагов и источники

- **Реестр**: `lib/ff/flags.ts` – `FLAG_REGISTRY`, тип `FlagName`, `EffectiveValueFor<Name>`.
- **ENV (прод/стейдж)**: `FEATURE_FLAGS_JSON` (структурированный JSON).
- **Overrides (user-level)**: cookie `sv_flags_override` через `GET /api/ff-override?ff=...`.
- **Global overrides (admin emergency)**: in-memory (S3E) через `POST /api/admin/ff-emergency-disable`.
- **Стабильный ID**: `u:<userId>` (если авторизован и валиден) → иначе `sv_id` → иначе `anon`.

### Приоритеты (итоговое значение)
| Источник            | Приоритет | Примечание                                   |
|--------------------|-----------|----------------------------------------------|
| Global override    | 1         | Админ отключил/включил глобально             |
| Cookie override    | 2         | Булевый override перекрывает rollout         |
| ENV JSON           | 3         | Структура флага (enabled/percent/salt/…)     |
| Default (registry) | 4         | `FLAG_REGISTRY[*].defaultValue`              |

> **Булевый override** всегда форсирует результат, даже если `enabled=false` в ENV.  
> **WARNING:** `salt` влияет на распределение. Изменение `salt` → перераспределение пользователей.

## 2. Rollout Playbook

### Шаг 1: Создать флаг (0%)
ENV:
```bash
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":false}}'
```

Код:

```tsx
// Используйте серверный гейт (SSR), значения берите из useFlags()/getFlagsServer()
<PercentGateServer name="newCheckout">
  <NewCheckoutFlow />
</PercentGateServer>
```

Деплой → фича выключена у всех.

### Шаг 2: Canary (1–5%)

ENV:

```bash
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":true,"percent":1}}'
```

Мониторим 24–48h:

- Error rate, API p99, Web Vitals p95.
- Бизнес метрики (конверсия) – не блокируют, но наблюдаем.

Откат (при проблемах):

```bash
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":false}}'
```

### Шаг 3: Расширение (5% → 25% → 50%)

Увеличиваем percent ступенями каждые 2–3 дня при стабильных метриках.

### Шаг 4: Full rollout (100%)

```bash
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":true,"percent":100}}'
# или коротко:
FEATURE_FLAGS_JSON='{"newCheckout":true}'
```

Подождать 1–2 недели, убедиться в стабильности.

### Шаг 5: Удаление флага (Migration Path)

1. Убрать гейт из кода, оставить `<NewCheckoutFlow />`.
2. Деплой.
3. Удалить флаг из ENV.
4. Пометить в реестре `deprecated: true`, выставить `sunsetDate`.
5. Через `sunsetDate` – удалить из `FLAG_REGISTRY` + тестов + поиска по коду.

## 3. Exposure & Observability

- SSR: дедуп экспозиций через `AsyncLocalStorage` (`withExposureContext`, S4C).
- CSR: `trackExposureClient` – дедуп на вкладку (`sessionStorage`).

Dev эндпойнты:

- `/api/dev/flags-events` – последние события (если `NEXT_PUBLIC_DEV_TOOLS=true`).

Событие exposure: `{ ts, flag, value, source, stableId, userId? }`.

## 4. Troubleshooting

Флаг “не работает”:

- Проверить `FEATURE_FLAGS_JSON` (валидный JSON?).
- Проверить cookies → `sv_flags_override`, `sv_id`.
- Проверить реестр и тип значения.
- Проверить приоритеты (override > env).
- Ваш `sv_id` может быть вне rollout → форсируйте `?ff=flag:true`.

Hydration mismatch:

- Используйте `<FlagsProvider serverFlags={...}>` и `useFlags()`/SSR‑гейты.

Override не срабатывает:

- Проверить редирект с `/api/ff-override` и `Set-Cookie`.
- Ограничение размера cookie (~3KB), число флагов ≤ 50.
- Прод игнорирует unknown флаги (варнинг), dev – 400.

Процент “не совпадает”:

- Малая выборка (шум).
- Изменили `salt` (перераспределение).
- Кэширование/боты – проверьте UA.

## 5. Governance & Doctor

- `npm run ff:doctor[:strict]` – ищет реальное использование флагов по паттернам (`useFlag('x')`, `<FlagGate name="x" />`, `?ff=x:`).
- Ошибки: unknown usage; Варнинги: unused.
- Allow‑лист: `scripts/ff-doctor.allow`.

## 6. Security & Privacy

- ENV с конфигом не уходит на клиент (только серверный доступ).
- `sv_id` – не PII, `u:<userId>` – только нормализованный идентификатор.
- Не логируем содержимое ENV; телеметрия – только локальный sink по умолчанию.
- `/api/ff-override` и `/api/admin/*` – валидация входа + лимиты (S3A/S3E).

## 7. API Reference (кратко)

- `GET /api/ff-override?ff=name:true|false|value` – установить cookie override; 302 на referer//.
- `POST /api/ff-exposure` – клиентские экспозиции (опц., S4C).
- `POST /api/admin/ff-emergency-disable` – глобальный override (S3E), с токеном.

## 8. Best Practices

- Не меняйте `salt`, если не хотите пересэмплировать пользователей.
- Имена критичных флагов версионируйте: `feature_v1`, `feature_v2`.
- Включайте codegen (`ff:codegen`) – типобезопасность `useFlag()`.
