# Troubleshooting Guide

1. Флаг не включается/выключается

- Проверьте ENV (`echo $FEATURE_FLAGS_JSON`) – валидный JSON?
- Проверьте cookie `sv_flags_override` и `sv_id` в DevTools.
- Посмотрите `FLAG_REGISTRY` – тип значения соответствует?
- Проверьте таблицу приоритетов (override > env > default).
- Форсируйте `?ff=flag:true` (dev) и убедитесь, что влияет.

2. Hydration / Гидратация «Text content did not match»

- Нельзя читать флаги напрямую на клиенте; используйте `useFlags()` в клиентах и SSR‑гейты.
- Убедитесь, что `<FlagsProvider serverFlags={...}>` есть в `app/layout.tsx`.

3. Override не работает

- `/api/ff-override` должен вернуть 302 и `Set-Cookie`.
- Размер JSON override ≤ 3KB; ≤ 50 ключей; значения типов – boolean/string/number.
- В prod – unknown игнорируются (warning; dev – 400).

4. Процент раскатки «пляшет»

- Убедитесь, что `salt` не менялся.
- Увеличьте выборку (меньше шума).
- Исключите ботов/краулеров из аналитики.

5. Доктор (Doctor, `ff:doctor`)

- `unknown flag usage` → опечатка/динамика. Решение: исправить имя или добавить `allow-unknown` в `scripts/ff-doctor.allow`.
- `unused` → флаг в реестре не используется. Решение: удалить или добавить `use:` в allow‑лист, если используется динамически.
