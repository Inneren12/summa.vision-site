import "server-only";

import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const headersObj = Object.fromEntries(req.headers.entries());
  const snap = headersObj["x-ff-snapshot"] ?? "";
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false }, { status: 400 });

  const rec = {
    type: "js_error",
    ts: Date.now(),
    snap,
    message: String(payload.message ?? "").slice(0, 300),
    url: payload.url,
    ua: payload.ua,
  };
  const target = process.env.METRICS_ERRORS_FILE || "./.runtime/errors.ndjson";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(rec) + "\n");
  return NextResponse.json({ ok: true });
}
