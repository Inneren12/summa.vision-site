import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExposureEvent = { type: "exposure"; gate: string; source?: string; ts: string };

type FlagsEventsStore = { events: ExposureEvent[] };

type GlobalWithStore = typeof globalThis & {
  __SV_DEV_FLAGS_STORE__?: FlagsEventsStore;
};

function ensureStore(globalObject: GlobalWithStore): FlagsEventsStore {
  if (!globalObject.__SV_DEV_FLAGS_STORE__) {
    globalObject.__SV_DEV_FLAGS_STORE__ = { events: [] };
  }
  const store = globalObject.__SV_DEV_FLAGS_STORE__;
  if (!Array.isArray(store.events)) {
    store.events = [];
  }
  return store;
}

function json<T>(body: T) {
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  const store = ensureStore(globalThis as GlobalWithStore);

  try {
    const url = new URL(req.url);
    const emit = url.searchParams.get("emit");
    const eventType = (url.searchParams.get("etype") || "exposure").toLowerCase();
    const source = url.searchParams.get("source") || "e2e";

    if (emit && eventType === "exposure") {
      const now = new Date().toISOString();
      emit
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((gate) => {
          store.events.push({ type: "exposure", gate, source, ts: now });
        });
    }
  } catch {
    // ignore malformed URLs
  }

  return json({ events: store.events });
}
