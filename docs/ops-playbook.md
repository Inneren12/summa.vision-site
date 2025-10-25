# Ops Playbook (мини-runbook)

> Цель: сократить время реакции на инциденты и упростить онбординг инженеров поддержки.

## 0. Чек-лист перед началом

- Убедитесь, что у вас есть ops/admin токен (`FF_CONSOLE_OPS_TOKENS` или `FF_ADMIN_TOKEN`).
- Проверьте состояние рантайма: `curl -H "Authorization: Bearer $FF_ADMIN_TOKEN" https://<host>/ops/summary`.
- Локально держите директорию `.runtime/` смонтированной или доступной для чтения (telemetry/vitals/errors.ndjson, flags.snapshot.json).

---

## 1. Kill-switch & freeze

### Включить/выключить kill-switch

**Глобально (все флаги):**

```bash
curl -X POST https://<host>/api/kill \
  -H "Authorization: Bearer $FF_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable":true,"reason":"incident-123"}'
# disable → "enable":false
```

- Запрос требует роли `admin` (`authorizeApi(req, "admin")`).
- Эндпоинт включает/выключает как `kill`, так и `killSwitch` для всех флагов через `FF().store`.
- Проверить состояние: `GET /ops/summary` → поле `killAll` (`true`/`false`).
- Для небулевых флагов kill-switch возвращает `killValue`, а при его отсутствии `undefined`. Клиенты обязаны трактовать
  `undefined`/`null` как выключенное состояние.

**По namespace:**

```bash
curl -X POST https://<host>/api/kill \
  -H "Authorization: Bearer $FF_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable":true,"namespace":"tenant:summa"}'
```

**Список флагов:**

```bash
curl -X POST https://<host>/api/kill \
  -H "Authorization: Bearer $FF_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable":false,"flags":["betaUI","newCheckout"]}'
```

- На каждый ключ накладывается блокировка (`lock.withLock`) → повторные запросы безопасны.
- В логи аудита (`lib/ff/audit.ts`) пишутся `kill_switch` события; reason помогает постфактум анализировать изменения.

### Freeze overrides (`FF_FREEZE_OVERRIDES`)

- Временами нужно заблокировать `POST /api/flags/<key>/override`.
- Установите `FF_FREEZE_OVERRIDES=true` и перезапустите рантайм.
- Проверить: `GET /ops/summary` → `freezeOverrides:true`.
- При попытке создать override, API вернёт `423` и сообщение `Overrides are frozen`.

> **Примечание:** freeze блокирует только API; cookie overrides у пользователей остаются в силе.

---

## 2. NDJSON журналы и поиск всплесков

Файлы лежат в `.runtime/` (см. `lib/ff/runtime.ts`):

| Файл | Содержимое |
| --- | --- |
| `.runtime/telemetry.ndjson` | ff-метрики (`telemetry/export`, custom events) |
| `.runtime/vitals.ndjson` | Web Vitals (`INP`, `CLS`, `LCP`, `FCP`) |
| `.runtime/errors.ndjson` | ошибки и stack traces (`/api/js-error`) |

### Быстрый просмотр последнего события

```bash
tail -n 5 .runtime/errors.ndjson
jq -r '.message + " @" + (.ts|tostring)' .runtime/errors.ndjson | tail -n 20
```

### Поиск всплесков через DuckDB

```bash
duckdb -c "INSTALL json; LOAD json;"
# пример: ошибки по snapshotId за последний час
duckdb <<'SQL'
SELECT snapshotId, COUNT(*) AS errors
FROM read_json_auto('.runtime/errors.ndjson')
WHERE ts >= epoch_ms() - 3600 * 1000
GROUP BY snapshotId
ORDER BY errors DESC
LIMIT 20;
SQL
```

Для vitals используйте агрегации по percentiles:

```bash
duckdb <<'SQL'
SELECT snapshotId,
       quantile(value, 0.95) FILTER (WHERE metric = 'INP') AS inp_p95,
       quantile(value, 0.95) FILTER (WHERE metric = 'CLS') AS cls_p95
FROM read_json_auto('.runtime/vitals.ndjson')
GROUP BY snapshotId
ORDER BY inp_p95 DESC
LIMIT 10;
SQL
```

- `snapshotId` соответствует заголовку `x-ff-snapshot` (см. middleware и `docs/rollouts.md`).
- Если DuckDB недоступен, используйте `rg 'snapshotId' .runtime/*.ndjson | sort` для грубой оценки.

### Корреляция по `x-request-id`

- Каждый HTTP-запрос получает заголовок `x-request-id` (ULID). Проверить легко:

  ```bash
  curl -i https://<host>/ | grep -i x-request-id
  ```

- Для сквозной трассировки передайте свой идентификатор — он вернётся в ответ и попадёт во все события telemetry/metrics:

  ```bash
  curl -i https://<host>/api/flags \
    -H 'x-request-id: demo-123'
  ```

- Искомый идентификатор присутствует в `.runtime/*.ndjson` (telemetry, vitals, errors). Для поиска используйте `rg` или `jq`:

  ```bash
  rg '"requestId":"demo-123"' .runtime/*.ndjson
  # либо
  jq -r 'select(.requestId == "demo-123")' .runtime/telemetry.ndjson
  ```

- Поля `sessionId` и `namespace` добавляются рядом, поэтому корреляцию можно расширять до конкретной сессии/тенанта.

---

## 3. Dry-run / apply rollout-политик

Скрипт `scripts/ff-rollout.mjs` выполняет dry-run/apply шаги для стратегии из JSON-политики.

1. Подготовьте `policy.json`:

```json
{
  "host": "https://flags.internal",
  "flag": "newCheckout",
  "steps": [5, 25, 50, 100],
  "minSamples": 2000,
  "coolDownMs": 7200000,
  "token": "${FF_ADMIN_TOKEN}"
}
```

2. Dry-run в CI/локально:

```bash
node scripts/ff-rollout.mjs --policy=./policy.json --dry-run
```

- Скрипт запросит `/api/flags/<flag>` и рассчитает следующий шаг (`nextRolloutStep`).
- Метрики (`metrics` блок) берутся из `FF().metrics.summarize()` (см. вывод в консоли).

3. Apply вручную (после верификации):

```bash
node scripts/ff-rollout.mjs --policy=./policy.json --apply
```

- `--apply` повторно делает dry-run, затем вызовет `/api/flags/<flag>/rollout/step`.
- Для авторизации используйте Bearer токен (`resolveToken` читает ENV).
- Скрипт завершится ошибкой, если API вернёт `>=400` или если policy неконсистентна.

---

## 4. Восстановление из snapshot

Используйте `scripts/ff-snapshot.mjs` (см. `docs/rollouts.md`).

### Экспорт

```bash
node scripts/ff-snapshot.mjs export ./snapshot.json \
  --host=https://flags.internal \
  --token=$FF_ADMIN_TOKEN
```

- Выгружает `FlagSnapshot` (`flags[]`, `overrides[]`) через `GET /ops/snapshot`.
- Файл пригодится для отката или копирования окружения.

### Restore

```bash
node scripts/ff-snapshot.mjs restore ./snapshot.json \
  --host=https://flags.internal \
  --token=$FF_ADMIN_TOKEN --yes
```

- Отправляет payload на `POST /ops/restore` и блокирует запись через `snapshot:restore` lock.
- Скрипт перезапишет конфигурацию и overrides атомарно; `FF().metrics` пересчитает `snapshotId`.
- После восстановления проверьте `GET /ops/summary` и запустите smoke (`npm run ff:doctor`).

> **Совет:** храните снапшоты в S3/git-lfs, чтобы иметь историю изменений.

---

## 5. Частые ошибки и быстрые решения

| Симптом | Причина | Решение |
| --- | --- | --- |
| `403 invalid` при обращении к `/api/kill` | Токен не входит в `FF_CONSOLE_ADMIN_TOKENS`/`FF_ADMIN_TOKEN` | Обновить токен, убедиться, что используете `Bearer` заголовок |
| `Overrides are frozen` | Активирован `FF_FREEZE_OVERRIDES` | Снять freeze (`FF_FREEZE_OVERRIDES=false` + рестарт) или подождать, пока freeze снимет администратор |
| `Validation failed` в `/api/kill` | Payload не прошёл схему (`enable` обязательный) | Проверьте JSON: `{"enable":true}` и корректный `namespace`/список флагов |
| Rollout apply не двигается | Недостаточно метрик (`minSamples` или stop/hysteresis) | Посмотреть `metrics` в dry-run, увеличить наблюдение, проверить NDJSON |
| `/ops/snapshot` → `404` | Рантайм без ops endpoints | Убедиться, что деплой содержит `app/ops/*`, проверить маршруты в Next.js |
| Restore возвращает `423 Locked` | Включён `snapshot:restore` lock (другой restore в процессе) | Подождать завершения или сбросить lock (`redis`/`store`), повторить |
| После restore метрики пустые | `.runtime/*.ndjson` не перезаписаны | Импортируйте архив метрик или подождите новых событий; проверьте `METRICS_PROVIDER` |

---

## 6. Готовые команды

```bash
# Проверить состояние
curl -H "Authorization: Bearer $FF_ADMIN_TOKEN" https://<host>/ops/summary | jq

# Снять глобальный kill
curl -X POST https://<host>/api/kill \
  -H "Authorization: Bearer $FF_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable":false,"reason":"post-incident"}'

# Список overrides по флагу
curl -H "Authorization: Bearer $FF_ADMIN_TOKEN" https://<host>/api/flags/newCheckout/override | jq

# Удалить override для tenant
curl -X POST https://<host>/api/flags/newCheckout/override \
  -H "Authorization: Bearer $FF_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"namespace":"tenant:summa","value":false,"ttlSec":0}'

# Быстрый анализ vitals (DuckDB)
duckdb <<'SQL'
SELECT metric,
       round(avg(value), 3) AS avg_value,
       round(quantile(value, 0.95), 3) AS p95,
       COUNT(*) AS samples
FROM read_json_auto('.runtime/vitals.ndjson')
GROUP BY metric
ORDER BY p95 DESC;
SQL
```

---

## 7. Поддержка и обновление

- Документ обновляем при изменении API (`/api/kill`, `/ops/*`) и поведения скриптов.
- При деплое новых операций добавляйте короткие рецепты (команда + описание).
- Если ENV-переменные переименованы, отразите это в секциях kill/freeze и snapshot.

> **Reminder:** вместе с PR, изменяющим runtime/ops поведения, обновляйте этот playbook, иначе он устареет.
