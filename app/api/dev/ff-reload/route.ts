import "server-only";
import { NextResponse } from "next/server";

import { __resetEnvCache } from "@/lib/ff/server";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  __resetEnvCache();
  return NextResponse.json({ ok: true });
}
