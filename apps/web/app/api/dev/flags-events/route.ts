import { NextRequest, NextResponse } from "next/server";

import { appendExposure, getEvents } from "@/lib/dev/exposure-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("emit") === "exposure") {
      const gate = url.searchParams.get("gate") ?? "identical-gates";
      const source = url.searchParams.get("source") ?? "api";
      await appendExposure({ gate, source });
    }
  } catch {
    // ignore malformed URLs
  }

  const events = await getEvents();
  return NextResponse.json({ events }, { headers: { "cache-control": "no-store" } });
}
