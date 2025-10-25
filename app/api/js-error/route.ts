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

async function readJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractSnapshotFromUrl(req: Request): string | undefined {
  try {
    const url = new URL(req.url);
    const value = url.searchParams.get("snapshot");
    return value ? value.trim() || undefined : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBatch(
  payload: unknown,
): { events: Record<string, unknown>[]; snapshotFromBody?: string } | null {
  if (Array.isArray(payload)) {
    const events = payload.filter((item): item is Record<string, unknown> => isRecord(item));
    return { events };
  }
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.events)) {
    const events = payload.events.filter((item): item is Record<string, unknown> => isRecord(item));
    return {
      events,
      snapshotFromBody: typeof payload.snapshot === "string" ? payload.snapshot.trim() : undefined,
    };
  }
  return { events: [payload] };
}

export async function POST(req: Request) {
  const json = await readJson(req);
  const batch = normalizeBatch(json);
  if (!batch || batch.events.length === 0) {
    return badRequest("Expected JSON payload");
  }

  const headerSnapshot = (req.headers.get("x-ff-snapshot") || "").trim();
  const bodySnapshot = batch.snapshotFromBody?.trim() || "";
  const urlSnapshot = extractSnapshotFromUrl(req) || "";
  const snapshotId = (headerSnapshot || bodySnapshot || urlSnapshot).trim();
  if (!snapshotId) {
    return badRequest("Missing snapshot identifier");
  }

  if (hasDoNotTrackEnabled(req.headers)) {
    const response = new Response(null, { status: 204 });
    response.headers.set("sv-telemetry-status", "ok:true, skipped:true");
    return response;
  }

  const consent = readConsent(req.headers);
  const { sid, aid } = readIdentifiers(req.headers);
  const correlation = correlationFromRequest(req);
  for (const payload of batch.events) {
    const rawMessage = typeof payload.message === "string" ? payload.message : undefined;
    const message = sanitizeMessage(consent, rawMessage);
    const stack = typeof payload.stack === "string" ? payload.stack : undefined;
    const url = typeof payload.url === "string" ? payload.url : undefined;
    const filename = typeof payload.filename === "string" ? payload.filename : undefined;

    FF().metrics.recordError(snapshotId, message, sanitizeStack(consent, stack), {
      context: correlation,
      url: sanitizeUrl(consent, url),
      filename: sanitizeFilename(consent, filename),
      sid,
      aid,
    });
  }

  return new NextResponse(null, { status: 204 });
}
