import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type FlagEvent = { name: string; ts: number };
type FlagsEventsPayload = { events: FlagEvent[] };

type GlobalWithStore = typeof globalThis & {
  __SV_FLAGS_EVENTS__?: FlagsEventsPayload;
};

function ensureStore(globalObject: GlobalWithStore): FlagsEventsPayload {
  if (!globalObject.__SV_FLAGS_EVENTS__) {
    globalObject.__SV_FLAGS_EVENTS__ = { events: [] };
  }
  const store = globalObject.__SV_FLAGS_EVENTS__;
  if (!Array.isArray(store.events)) {
    store.events = [];
  }
  return store;
}

function json<T>(body: T) {
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  const e2e = process.env.SV_E2E === "1" || process.env.NEXT_PUBLIC_E2E === "1";
  const allow =
    process.env.NODE_ENV !== "production" || e2e || process.env.SV_ALLOW_DEV_API === "1";

  const store = ensureStore(globalThis as GlobalWithStore);

  try {
    const url = new URL(req.url);
    const emit = url.searchParams.get("emit");
    if (emit && allow) {
      const now = Date.now();
      emit
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((name) => {
          if (!store.events.some((event) => event.name === name)) {
            store.events.push({ name, ts: now });
          }
        });
    }
  } catch {
    // ignore malformed URLs
  }

  if (!allow) {
    return json({ events: [] });
  }

  return json({ events: store.events });
}
