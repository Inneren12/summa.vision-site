import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";
import { correlationFromRequest } from "@/lib/metrics/correlation";
import {
  hasDoNotTrackEnabled,
  readConsent,
  readIdentifiers,
  sanitizeMessage,
  sanitizeStack,
  sanitizeFilename,
  sanitizeUrl,
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
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  const payload = await readJson(req);
  if (!payload) {
    return badRequest("Expected JSON payload");
  }

  const consent = readConsent(req.headers);
  const { sid, aid } = readIdentifiers(req.headers);
  const rawMessage = typeof payload.message === "string" ? payload.message : undefined;
  const message = sanitizeMessage(consent, rawMessage);
  const stack = typeof payload.stack === "string" ? payload.stack : undefined;
  const url = typeof payload.url === "string" ? payload.url : undefined;
  const filename = typeof payload.filename === "string" ? payload.filename : undefined;

  const correlation = correlationFromRequest(req);
  FF().metrics.recordError(snapshotId, message, sanitizeStack(consent, stack), {
    context: correlation,
    url: sanitizeUrl(consent, url),
    filename: sanitizeFilename(consent, filename),
    sid,
    aid,
  });

  return new NextResponse(null, { status: 204 });
}
