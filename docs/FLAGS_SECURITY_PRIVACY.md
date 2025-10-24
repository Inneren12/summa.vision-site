# Security & Privacy Appendix

1. Данные и границы

- `FEATURE_FLAGS_JSON` – доступен только на сервере; запрещена утечка в клиент.
- `sv_id` (анонимный UUID) – cookie `SameSite=Lax`, `Secure` (prod), `Path=/`.
- `u:<userId>` – только нормализованная строка из подписанной auth‑cookie.

2. Threat model

- Подмена override: cookie – пользовательский уровень. Булевый override форсирует результат.
  - Mitigation: dev/QA инструмент, прод – игнор unknown; лимиты на `/api/ff-override`.
- DoS через override API: rate limit (S3A), валидация payload, `Retry-After`.
- Утечка ENV: доступ к ENV – только на сервере; проверка отсутствия инжектов в client‑бандлах.

3. Поведение при логине/логауте

- При логине – начинаем использовать `u:<userId>` вместо `sv_id`. Раскатка становится кросс‑девайс.
- При логауте – fallback на `sv_id`.

4. Политика логирования

- Запрещено логировать содержимое ENV/секреты.
- В экспозициях – хранить только `{ flag, value, source, stableId, userId? }` без PII.
