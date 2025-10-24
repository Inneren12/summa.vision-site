import "server-only";

import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const headersObj = Object.fromEntries(req.headers.entries());
  const snap = headersObj["x-ff-snapshot"] ?? "";
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const rec = { type: "vital", ts: Date.now(), snap, ...body };
  const target = process.env.METRICS_VITALS_FILE || "./.runtime/vitals.ndjson";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(rec) + "\n");
  return NextResponse.json({ ok: true });
}
