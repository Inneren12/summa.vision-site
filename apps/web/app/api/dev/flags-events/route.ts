import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExposureEvent = { type: "exposure"; flag: string; source?: string; ts: string };

type FlagsEventsStore = { events: ExposureEvent[] };

type GlobalWithStore = typeof globalThis & {
  __SV_DEV_FLAGS_STORE__?: FlagsEventsStore;
};

const CACHE_HEADERS = { "cache-control": "no-store" } as const;

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
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}

function isDevApiEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.SV_ALLOW_DEV_API === "1" || process.env.NEXT_PUBLIC_E2E === "1";
}

function cookieSecureFlag(req: NextRequest) {
  return req.nextUrl.protocol === "https:";
}

function logExposure(store: FlagsEventsStore, flag: string, source: string) {
  store.events.push({ type: "exposure", flag, source, ts: new Date().toISOString() });
}

function parseEmitParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function GET(req: NextRequest) {
  const store = ensureStore(globalThis as GlobalWithStore);

  if (!isDevApiEnabled()) {
    return json({ events: [] });
  }

  const mark = req.cookies.get("sv_exposure_mark");
  const allowManualEmit = true;

  if (mark?.value) {
    logExposure(store, mark.value, "ssr-cookie");
  }

  if (allowManualEmit) {
    try {
      const emitParam = req.nextUrl.searchParams.get("emit");
      const source = req.nextUrl.searchParams.get("source") ?? "e2e";
      const type = (req.nextUrl.searchParams.get("etype") ?? "exposure").toLowerCase();
      if (type === "exposure") {
        for (const flag of parseEmitParam(emitParam)) {
          logExposure(store, flag, source);
        }
      }
    } catch {
      // ignore malformed URLs
    }
  }

  const response = json({ events: store.events });

  if (mark?.value) {
    response.cookies.set({
      name: "sv_exposure_mark",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookieSecureFlag(req),
      maxAge: 0,
    });
  }

  return response;
}
