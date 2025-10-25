# Rollouts и откаты

Этот документ описывает политику rollout'ов, dry-run/apply цикл и процедуры отката. Параметры и типы определены в `lib/ff/runtime/types.ts` и контроллерах из `app/api/flags/[key]/rollout/step/route.ts`.

## Политика rollout

- **Policy JSON**: используйте `scripts/ff-rollout.mjs --policy=./policy.json --dry-run|--apply`. Файл должен содержать `flag`, `steps`, опционально `stop`, `coolDownMs`, `hysteresis`, `minSamples` и `token`.
- **Dry-run** (`--dry-run`) выводит план без обращения к API, но проверяет доступность токена.
- **Apply** (`--apply`) вызывает `/api/flags/<flag>/rollout/step` и фиксирует изменения в аудите (`logAdminAction`).
- **Cooldown** (`coolDownMs`) блокирует повторный rollout до истечения окна. Значение хранится в store (смотрите ответ API: `coolDownUntil`).
- **Hysteresis**: если указано `policy.hysteresis`, контроллер проверяет метрики `errorRate`, `CLS`, `INP` и не позволит понизить rollout, пока показатели не вернутся ниже порогов.

## Stop-пороги

`policy.stop` поддерживает поля `maxErrorRate`, `maxCLS`, `maxINP`. При превышении любого из порогов rollout принудительно блокируется (`action: "rollout_blocked"` в аудите) до ручного вмешательства.

## Dry-run vs apply

| Режим     | Что делает                                         |
|-----------|----------------------------------------------------|
| Dry-run   | Валидация policy, проверка access token, расчёт шага |
| Apply     | Выполняет dry-run и, если всё ok, вызывает API      |

`dry-run` рекомендуется запускать в CI, `apply` — только вручную с подтверждением.

## Снапшоты и откаты

`scripts/ff-snapshot.mjs` поддерживает два режима:

```bash
node scripts/ff-snapshot.mjs export ./snapshot.json
node scripts/ff-snapshot.mjs restore ./snapshot.json
```

- **export** вызывает `GET /ops/snapshot` и сохраняет JSON `FlagSnapshot` (`flags[] + overrides[]`). По умолчанию используется `http://localhost:3000`; переопределить можно через `--host` или `FF_SNAPSHOT_HOST`.
- **restore** читает JSON, спрашивает подтверждение (или используйте `--yes`), затем вызывает `POST /ops/restore`. Маршрут требует роли `ops` (токен `FF_CONSOLE_OPS_TOKENS`/`ADMIN_TOKEN_OPS`). После успешного восстановления возвращает количество применённых флагов/overrides.
- Снапшоты хранят **локально** (вне репозитория) и не шифруются. Не загружайте их в артефакты CI/CD без защиты.

Формат снапшота соответствует `lib/ff/runtime/types.ts#FlagSnapshot`. После restore рантайм пересчитывает `x-ff-snapshot` и обновляет `.runtime/flags.snapshot.json` (при использовании file-адаптера).

## Экстренные тумблеры

- `FF_KILL_ALL=true` — мгновенно отключает все флаги и rollout'ы (`MemoryFlagStore` проверяет переменную при каждом чтении).
- `FF_FREEZE_OVERRIDES=true` — блокирует создание overrides через `/api/flags/<flag>/override`.
- Тумблеры не сохраняются в снапшотах, поэтому после restore их состояние нужно выставлять вручную (если требуется).

## Мониторинг состояния

- `x-ff-snapshot` — заголовок, который добавляется middleware (см. `middleware.ts`). В браузере: откройте вкладку Network, выберите любой HTML/JSON запрос → Headers → `x-ff-snapshot`. Совпадение значения между вкладками гарантирует идентичную конфигурацию.
- `.runtime/*.ndjson` — локальные журналы (`telemetry.ndjson`, `vitals.ndjson`, `errors.ndjson`). Рекомендуемый cron/скрипт: `find .runtime -name '*.ndjson' -size +10M -exec truncate -s 0 {} \;`. Настройте logrotate, если работаете в долгоживущем окружении.

