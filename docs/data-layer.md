# Data layer (S5B)

S5B отчёты строятся поверх локальных журналов рантайма (`.runtime/*.ndjson`). Они собираются провайдером `SelfMetricsProvider` из `lib/ff/runtime/self-metrics.ts` и используются `/app/api/vitals`, `/app/api/js-error` и `/app/ops/summary`.

## Где лежат данные

- `.runtime/vitals.ndjson` — события Web Vitals (`INP`, `CLS`, `LCP`, `FCP`).
- `.runtime/errors.ndjson` — ошибки, записанные через `/api/js-error`.
- `.runtime/telemetry.ndjson` — произвольные ff-метрики.
- `.runtime/flags.snapshot.json` — текущая конфигурация флагов (если активирован file store).

## Ротация и компакция NDJSON

- Порог размера и возраста задаются переменными `METRICS_ROTATE_MAX_MB` (по умолчанию 50 MB) и `METRICS_ROTATE_DAYS` (по умолчанию 7).
- Кроним `node scripts/metrics-rotate.mjs` — он перемещает «переполненные» файлы в чанки `vitals-YYYYMMDD.ndjson`, `errors-YYYYMMDD.ndjson`, `telemetry-YYYYMMDD.ndjson` и пересоздаёт активные файлы.
- Компакция `node scripts/metrics-compact.mjs --days=14` объединяет мелкие чанки, удаляет устаревшие (старше `--days` или `METRICS_ROTATE_DAYS`) и применяет DSR‑purge к новым файлам, чтобы не перебирать гигабайты в cron.
- Self-metrics провайдер читает только ограниченное окно чанков (`maxChunkDays`, `maxChunkCount`) и кэширует результаты на 30 секунд.

## Чтение отчётов S5B

1. Установите [DuckDB](https://duckdb.org/).
2. Выполните `duckdb < duckdb/smoke_rowcount.sql` — скрипт читает NDJSON файлы, агрегирует счётчики и сохраняет отчёт в `reports/data/duckdb_smoke_rowcount.json`.
3. Альтернативно, откройте интерактивную сессию: `duckdb -c "INSTALL json; LOAD json"` и выполняйте запросы к `read_json_auto('.runtime/vitals.ndjson')`.
4. Для post-processing используйте `reports/data/duckdb_smoke_rowcount.json` (S5B отчёт): поле `rows` показывает количество событий на срез (`snapshotId`, `metric`).

## Согласование с rollout'ами

- `scripts/ff-rollout.mjs` запрашивает метрики через `lib/ops/self-hosted-metrics-provider.ts` и ожидает, что S5B отчёты свежие (окно `METRICS_WINDOW_MS`).
- Перед увеличением rollout убедитесь, что `snapshotId` из отчёта совпадает с заголовком `x-ff-snapshot` (см. [docs/rollouts.md](./rollouts.md#мониторинг-состояния)).
- Если данных недостаточно (`sampleCount < minSamples`), rollout контроллер вернёт `blocked`.

