import "server-only";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const enable = json?.enable === true || json?.enabled === true;
  process.env.FF_KILL_ALL = enable ? "true" : "false";
  return NextResponse.json({ ok: true, killAll: process.env.FF_KILL_ALL === "true" });
}
