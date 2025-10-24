# Flags API Reference

## /api/ff-override (GET)

- Назначение: установить cookie override для флагов.
- Примеры:
  - `/api/ff-override?ff=betaUI:true`
  - `/api/ff-override?ff=bannerText:"Hello"`
  - `/api/ff-override?ff=betaUI:null` — удалить override (сброс)
- Коды ответов:
  - `302` → redirect (успех)
  - `400` → invalid format / unknown flags (dev)
  - `413` → overrides too large
  - `429` → too many requests (если включён rate limit)

## /api/ff-exposure (POST)

- Тело: `{ flag, value, source }` → записать экспозицию (CSR).
- Ограничение: `Content-Type: application/json`, ≤ 2KB.

## /api/admin/ff-emergency-disable (POST)

- Тело: `{ flag, value, ttlSec?, reason? }`.
- Требует токен (S3E). Влияет на глобальные overrides в памяти процесса.

## /api/dev/flags-events (GET)

- Только при `NEXT_PUBLIC_DEV_TOOLS=true`.
- Возвращает последние события телеметрии.
