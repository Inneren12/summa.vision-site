import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import type { ExposureSource } from "@/lib/ff/exposure";
import { FLAG_REGISTRY } from "@/lib/ff/flags";
import { FF } from "@/lib/ff/runtime";
import { sanitizeUserId, stableId as buildStableId } from "@/lib/ff/stable-id";
import { correlationFromRequest } from "@/lib/metrics/correlation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Do-Not-Track: если клиент запретил трекинг, не логируем
  try {
    if (headers().get("dnt") === "1") {
      return NextResponse.json({ ok: true });
    }
  } catch {
    /* ignore: headers() is unavailable outside a request context */
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 415 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 2048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = rawBody.length ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  if (typeof parsed !== "object" || parsed === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed as Record<string, unknown>;

  const flag = typeof body.flag === "string" ? body.flag : "";
  const source = typeof body.source === "string" ? (body.source as ExposureSource) : undefined;
  const value = body.value as boolean | string | number | null | undefined;
  const valueType = typeof value;
  const isValidValue =
    value === null || valueType === "boolean" || valueType === "string" || valueType === "number";

  if (!flag || !source || !ALLOWED_SOURCES.includes(source) || !isValidValue) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const normalizedValue = value as boolean | string | number | null;

  const stableId = buildStableId();
  const rawUserId = typeof body.userId === "string" ? body.userId : undefined;
  const userId = rawUserId ? sanitizeUserId(rawUserId) : undefined;
  const correlation = correlationFromRequest(req);

  try {
    const meta = FLAG_REGISTRY[flag as keyof typeof FLAG_REGISTRY];
    const safeValue = meta?.sensitive ? "[redacted]" : normalizedValue;
    FF().telemetrySink.emit({
      ts: Date.now(),
      type: "exposure",
      flag,
      value: safeValue,
      source,
      stableId,
      userId,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      namespace: correlation.namespace,
    });
  } catch {
    // ensure telemetry errors do not break response
  }

  return NextResponse.json({ ok: true });
}
