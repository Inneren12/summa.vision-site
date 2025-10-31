import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORE_PATH = process.env.SV_FLAGS_EVENTS_FILE ?? "/tmp/sv_flags_events.json";
const COOKIE_NAMES = ["sv_id", "sv_flags_override", "sv_use_env"];

export async function GET() {
  try {
    await fs.unlink(STORE_PATH);
  } catch {
    // ignore missing store
  }

  const response = NextResponse.json({ ok: true });
  for (const name of COOKIE_NAMES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
