import "server-only";

import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";
import { readRecent } from "@/lib/ff/telemetry";

export const runtime = "nodejs";

export async function GET() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const events = readRecent(500);
  return NextResponse.json({ events });
}
