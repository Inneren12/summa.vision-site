import "server-only";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";
import { __devSetFeatureFlagsJson } from "@/lib/ff/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 415 });
  }
  const text = await req.text();
  try {
    const data = JSON.parse(text);
    const envJson = typeof data?.envJson === "string" ? data.envJson : null;
    if (!envJson) {
      return NextResponse.json({ error: "envJson required" }, { status: 400 });
    }
    __devSetFeatureFlagsJson(envJson);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
}
