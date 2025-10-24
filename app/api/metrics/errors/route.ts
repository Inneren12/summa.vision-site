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
  const message = typeof payload.message === "string" ? payload.message : "Unknown error";
  const stack = typeof payload.stack === "string" ? payload.stack : undefined;
  FF().metrics.recordError(snapshotId, message, stack);
  return new NextResponse(null, { status: 204 });
}
