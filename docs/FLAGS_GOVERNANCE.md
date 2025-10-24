# Governance: правила и процессы

1. Ownership

- Каждый флаг обязан иметь `owner` и `description` в `FLAG_REGISTRY`.
- Для rollout флагов – указывать `defaultValue` с `enabled/percent/salt`.

2. Lifecycle

- `active` → `full` → `deprecated` → `sunset` (удаление).
- На этапе `deprecated` флаг остаётся в реестре до `sunsetDate`, чтобы обработать legacy overrides.

3. Проверки (Doctor)

- `npm run ff:doctor` – мягкий отчёт.
- `npm run ff:doctor:strict` – error при unknown usage.
- `scripts/ff-doctor.allow` – исключения для динамических случаев.

4. Документация

- Обновляйте `docs/FLAGS_PLAYBOOK.md` при добавлении новых процессов.
- Генерация: `npm run ff:codegen` обновляет `docs/flags.generated.md`.
