import { NextResponse } from "next/server";

/**
 * Disable static rendering / prerender and force Node.js runtime for this route.
 * This prevents next build from evaluating strict ENV loaders at import time.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type FlagsEventsPayload = { events: unknown[] };

function json<T>(body: T) {
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

function readGlobalStore(): FlagsEventsPayload {
  const globalWithStore = globalThis as typeof globalThis & {
    __SV_FLAGS_EVENTS__?: unknown;
  };
  const value = globalWithStore.__SV_FLAGS_EVENTS__;
  if (value && typeof value === "object" && "events" in value) {
    const maybe = value as { events?: unknown };
    if (Array.isArray(maybe.events)) {
      return { events: maybe.events };
    }
  }
  return { events: [] };
}

export async function GET() {
  const e2e = process.env.SV_E2E === "1" || process.env.NEXT_PUBLIC_E2E === "1";

  // В проде по умолчанию dev-эндпоинт не обязателен — возвращаем пустой каркас.
  // В E2E или при явном разрешении SV_ALLOW_DEV_API=1 — отвечаем так же безопасно.
  const allow =
    process.env.NODE_ENV !== "production" || e2e || process.env.SV_ALLOW_DEV_API === "1";

  if (!allow) {
    return json({ events: [] });
  }

  try {
    // Не дергаем строгие ENV-лоадеры здесь. Используем глобальный стор, если он есть.
    return json(readGlobalStore());
  } catch {
    return json({ events: [] });
  }
}
