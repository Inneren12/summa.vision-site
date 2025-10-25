# Feature Flags & Rollouts — Политики и Плейбук

Дополняющие материалы:

- [docs/flags.md](./flags.md) — структура конфигураций, seedBy, сегменты.
- [docs/rollouts.md](./rollouts.md) — политики rollout'ов, снапшоты и откаты.
- [docs/segments.md](./segments.md) — предикаты и приоритеты.
- [docs/data-layer.md](./data-layer.md) — отчёты S5B и чтение журналов.

## 1. Источники и приоритеты

**Источники (по возрастанию приоритета):**
1) Dev‑local JSON *(только* `NODE_ENV!=='production'` и **Node runtime**)*  
2) ENV JSON:  
   - server: `FEATURE_FLAGS_JSON`  
   - client: `NEXT_PUBLIC_FEATURE_FLAGS_JSON`
3) **Overrides**: cookie `sv_flags_override` (ставится через `/api/ff-override?ff=...`)

**Приоритет:** `overrides(cookie) > ENV(JSON) > dev‑local(JSON)`.

**Безопасность:** клиент не видит server‑ENV; в клиент попадает только **карта эффективных значений** через `FlagsProvider`.

---

## 2. Формат флагов

- **Булево (shorthand):**
  ```json
  { "betaUI": true }   // эквивалент {"betaUI": {"enabled": true}}
  ```
- **Структурированный rollout:**
  ```json
  { "newCheckout": { "enabled": true, "percent": 25, "salt": "cohort1" } }
  ```

`percent ∈ [0,100]`, `salt ≤ 64 символов`.

`enabled:false` → раскатка не выполняется (всегда OFF).

Если `enabled:true` и `percent` не задан → трактуем как 100%.

## 3. Таблица приоритетов (конфликты ENV/override)

| ENV | Cookie override | Итог |
| --- | --------------- | ---- |
| `{"f":{"enabled":true,"percent":25}}` | — | `inRollout(25%)` |
| `{"f":{"enabled":true,"percent":25}}` | `{"f":true}` | `true (override форсит)` |
| `{"f":{"enabled":true,"percent":25}}` | `{"f":false}` | `false (override форсит)` |
| `{"f":{"enabled":false}}` | `{"f":true}` | `true (override > ENV)` |
| `{"f":{"enabled":false}}` | — | `false` |
| — | `{"f":true}` | `true` |
| — | — | `defaultValue из реестра` |

**Правило:** булевый override всегда перекрывает раскатку.

## 4. Cookie‑лимиты и семантика overrides

Лимиты cookie `sv_flags_override`:

- JSON размер ≤ 3000 bytes
- Ключей ≤ 50
- Строки ≤ 256 символов
- Числа ∈ [‑1e6, 1e6]

**Спец‑значения:**

| Значение | Поведение |
| -------- | --------- |
| `null` | снять override (удалить ключ) |
| `undefined` | невалидный JSON → `400` |
| `""` | валидная пустая строка |
| отсутствие ключа | нет override → fallback на ENV/default |

`Dotted‑path` (`flag.percent:25`):
- Prod: игнорируется.
- Dev (опционально): разрешается `ALLOW_DOTTED_OVERRIDE=true`.

Атрибуты cookie: `Path=/`, `SameSite=Lax`, `Secure=true (prod)`, `HttpOnly=false`, опц. `Domain` через `FLAGS_COOKIE_DOMAIN`.

## 5. WARNING про salt

Изменение `salt` перемешивает пользователей (хеш зависит от `salt + stableId`).
Не меняйте `salt` для стабильности; для ресэмплинга — версионируйте флаг (`newCheckout_v2`) и переходите постепенно.

## 6. Где вызывать getFlagsServer()

Можно: Server Components (layout/page), Route Handlers, Server Actions.
Нельзя: Client Components, middleware (оно ставит только `sv_id`).
Практика: один вызов в корневом `app/layout.tsx` → `<FlagsProvider serverFlags={flags}>…</FlagsProvider>`; в клиенте используем `useFlags()`.

## 7. Rollout Playbook

**Шаг 1 — создать флаг (0%)**

```
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":false}}'
```

Деплой → фича выключена.

**Шаг 2 — Canary (1–5%)**

```
FEATURE_FLAGS_JSON='{"newCheckout":{"enabled":true,"percent":1}}'
```

Мониторим 24–48ч:

- Error rate: `+10%` от baseline → **ROLLBACK**
- Page Load p95: `+20%` → **ROLLBACK**
- API p99: `+30%` → **ROLLBACK**
- Conversion: `−5…−10%` → **HOLD 48ч**; `< −10%` → осторожный **ROLLBACK**
- Engagement: `−10%` → **HOLD** (может быть шум)

Откат: `{"newCheckout":{"enabled":false}}`.

**Шаг 3 — Расширение**

`percent: 5 → 25 → 50` (каждые 2–3 дня при норме метрик).

**Шаг 4 — Full rollout**

`{"newCheckout":{"enabled":true,"percent":100}}` или shorthand `{"newCheckout":true}`.
Наблюдаем 1–2 недели.

**Шаг 5 — Архивирование → Удаление (Migration Path)**

- В коде убрать гейтинг (оставить поведение «вкл.»), деплой.
- В реестре: `deprecated:true`, `sunsetDate`.
- Держать до `sunsetDate`, чтобы:
  - не ломать старые overrides в cookies,
  - сохранить исторический контекст.
- После `sunsetDate`: удалить из реестра/ENV/тестов; `global search` → 0 упоминаний.

**Emergency rollback:**

- ENV: `{"newCheckout":{"enabled":false}}` (требует рестарт окружения).
- (S3+) Admin API для глобального отключения — вне данного релиза.

## 8. Troubleshooting Guide

«Флаг не работает»

- Проверить `FEATURE_FLAGS_JSON / NEXT_PUBLIC_FEATURE_FLAGS_JSON` (валидный JSON).
- Проверить cookies (`sv_flags_override`, `sv_id`).
- Проверить реестр (`FLAG_REGISTRY`) — имя и тип флага.
- Источник в Dev‑панели: override > ENV > default.
- Попробовать `?ff=flag:true` для форса (QA).

**Гидратационные предупреждения**

Клиент не должен сам вычислять флаги — только через `useFlags()` из `FlagsProvider`.

«Процент раскатки не сходится»

- Выборка мала; изменён `salt`; кеширование; боты/краулеры — фильтруйте в аналитике.

## 9. Privacy

`sv_id` — анонимный ID, не PII, используется только для процентной раскатки, не для кросс‑доменного трекинга. Упоминается в Privacy Policy.

## 10. Будущее (S3+)

Rate limiting для `/api/ff-override`, Admin emergency API, телеметрия оценок флагов, дашборд, `ignoreOverrides` для security‑флагов, опционально `@vercel/flags`.
