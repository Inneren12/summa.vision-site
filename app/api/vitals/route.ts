import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";
import { correlationFromRequest } from "@/lib/metrics/correlation";
import {
  hasDoNotTrackEnabled,
  readConsent,
  readIdentifiers,
  sanitizeAttribution,
  sanitizeUrl,
} from "@/lib/metrics/privacy";

export const runtime = "nodejs";

type WebVitalPayload = {
  name?: unknown;
  value?: unknown;
  id?: unknown;
  startTime?: unknown;
  label?: unknown;
  rating?: unknown;
  delta?: unknown;
  navigationType?: unknown;
  attribution?: unknown;
  url?: unknown;
};

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

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function sanitizePayload(payload: Record<string, unknown>): WebVitalPayload {
  return {
    name: payload.name,
    value: payload.value,
    id: payload.id,
    startTime: payload.startTime,
    label: payload.label,
    rating: payload.rating,
    delta: payload.delta,
    navigationType: payload.navigationType,
    attribution: payload.attribution,
    url: payload.url,
  } satisfies WebVitalPayload;
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

  const correlation = correlationFromRequest(req);
  const consent = readConsent(req.headers);
  const { sid, aid } = readIdentifiers(req.headers);
  for (const rawEvent of batch.events) {
    const payload = sanitizePayload(rawEvent);
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const value = toFiniteNumber(payload.value);
    if (!name || value === undefined) {
      continue;
    }

    const metricsContext = { ...correlation } as typeof correlation & { aid?: string | undefined };
    if (sid) {
      metricsContext.sessionId = sid;
    }
    if (aid) {
      metricsContext.aid = aid;
    }
    const rating = typeof payload.rating === "string" ? payload.rating : undefined;
    const id = typeof payload.id === "string" ? payload.id : undefined;
    const startTime = toFiniteNumber(payload.startTime);
    const label = typeof payload.label === "string" ? payload.label : undefined;
    const delta = toFiniteNumber(payload.delta);
    const navigationType =
      typeof payload.navigationType === "string" ? payload.navigationType : undefined;
    const attribution =
      typeof payload.attribution === "object" && payload.attribution !== null
        ? (payload.attribution as Record<string, unknown>)
        : undefined;
    const url = typeof payload.url === "string" ? payload.url : undefined;

    FF().metrics.recordVital(snapshotId, name, value, {
      rating,
      id,
      startTime,
      label,
      delta,
      navigationType,
      attribution: sanitizeAttribution(consent, attribution),
      context: correlation,
      url: sanitizeUrl(consent, url),
      sid,
      aid,
    });
  }

  return new NextResponse(null, { status: 204 });
}
