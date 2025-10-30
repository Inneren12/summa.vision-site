import "server-only";


import { getEnv } from "@root/lib/env/load";
import { readRecent } from "@root/lib/ff/telemetry";
import { NextResponse } from "next/server";

const CACHE_HEADERS = { "cache-control": "no-store" } as const;
const E2E_MODE = process.env.SV_E2E === "1" || process.env.NEXT_PUBLIC_E2E === "1";
const ALLOW_DEV_API = process.env.SV_ALLOW_DEV_API === "1";

function guardJson<T>(producer: () => T) {
  try {
    return NextResponse.json(producer(), { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ events: [] }, { headers: CACHE_HEADERS });
  }
}

export const runtime = "nodejs";

export async function GET() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_DEV_TOOLS && !E2E_MODE && !ALLOW_DEV_API) {
    return guardJson(() => ({ events: [] }));
  }

  return guardJson(() => ({ events: readRecent(500) }));
}
