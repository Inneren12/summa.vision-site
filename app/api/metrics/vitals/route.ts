import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const payload = await readJson(req);
  if (!payload) {
    return badRequest("Expected JSON payload");
  }
  const snapshotId = typeof payload.snapshotId === "string" ? payload.snapshotId : undefined;
  if (!snapshotId) {
    return badRequest("snapshotId is required");
  }
  const metric = typeof payload.metric === "string" ? payload.metric : undefined;
  const value = typeof payload.value === "number" ? payload.value : undefined;
  if (!metric || typeof value !== "number" || Number.isNaN(value)) {
    return badRequest("metric and value required");
  }
  const rating = typeof payload.rating === "string" ? payload.rating : undefined;
  FF().metrics.recordVital(snapshotId, metric, value, rating);
  return new NextResponse(null, { status: 204 });
}
