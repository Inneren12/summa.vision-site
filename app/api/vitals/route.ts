import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";
import { hasDoNotTrackEnabled, readConsent, sanitizeAttribution } from "@/lib/metrics/privacy";

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
};

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
  } satisfies WebVitalPayload;
}

export async function POST(req: Request) {
  const snapshotId = (req.headers.get("x-ff-snapshot") || "").trim();
  if (!snapshotId) {
    return badRequest("Missing snapshot header");
  }

  if (hasDoNotTrackEnabled(req.headers)) {
    return new NextResponse(null, { status: 204 });
  }

  const json = await readJson(req);
  if (!json) {
    return badRequest("Expected JSON payload");
  }

  const payload = sanitizePayload(json);
  const name = typeof payload.name === "string" ? payload.name : undefined;
  const value = toFiniteNumber(payload.value);
  if (!name || value === undefined) {
    return badRequest("name and value are required");
  }

  const consent = readConsent(req.headers);
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

  FF().metrics.recordVital(snapshotId, name, value, {
    rating,
    id,
    startTime,
    label,
    delta,
    navigationType,
    attribution: sanitizeAttribution(consent, attribution),
  });

  return new NextResponse(null, { status: 204 });
}
