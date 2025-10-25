import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";
import {
  hasDoNotTrackEnabled,
  readConsent,
  redactMessage,
  sanitizeStack,
} from "@/lib/metrics/privacy";

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
  const snapshotId = (req.headers.get("x-ff-snapshot") || "").trim();
  if (!snapshotId) {
    return badRequest("Missing snapshot header");
  }

  if (hasDoNotTrackEnabled(req.headers)) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await readJson(req);
  if (!payload) {
    return badRequest("Expected JSON payload");
  }

  const consent = readConsent(req.headers);
  const rawMessage = typeof payload.message === "string" ? payload.message : undefined;
  const message = redactMessage(consent, rawMessage);
  const stack = typeof payload.stack === "string" ? payload.stack : undefined;

  FF().metrics.recordError(snapshotId, message, sanitizeStack(consent, stack));

  return new NextResponse(null, { status: 204 });
}
