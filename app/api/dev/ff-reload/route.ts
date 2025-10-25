import "server-only";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";
import { __resetEnvCache } from "@/lib/ff/server";

export const runtime = "nodejs";

export async function POST() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  __resetEnvCache();
  return NextResponse.json({ ok: true });
}
