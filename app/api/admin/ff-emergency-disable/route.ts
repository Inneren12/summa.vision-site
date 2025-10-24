import "server-only";
import { NextResponse } from "next/server";

import { logAdminAction } from "@/lib/ff/audit";
import { FLAG_REGISTRY, isKnownFlag } from "@/lib/ff/flags";
import { setGlobal, type GlobalValue } from "@/lib/ff/global";

export const runtime = "nodejs";

type Payload = {
  flag: string;
  value: boolean | string | number;
  ttlSeconds?: number;
  reason?: string;
};

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

async function readJsonWithLimit(
  req: Request,
  maxBytes = 1024,
): Promise<{ ok: true; data: Payload } | { ok: false; res: Response }> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Invalid content type" }, { status: 415 }),
    };
  }
  const cl = req.headers.get("content-length");
  if (cl && Number(cl) > maxBytes) {
    return { ok: false, res: NextResponse.json({ error: "Payload too large" }, { status: 413 }) };
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    return { ok: false, res: NextResponse.json({ error: "Payload too large" }, { status: 413 }) };
  }
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Malformed JSON" }, { status: 400 }) };
  }
}

type ValidationResult = { ok: true; value: GlobalValue } | { ok: false; msg: string };

function validateByRegistry(name: string, value: unknown): ValidationResult {
  if (!isKnownFlag(name)) return { ok: false, msg: `Unknown flag "${name}"` };
  const meta = (FLAG_REGISTRY as Record<string, { type: string }>)[name];
  switch (meta.type) {
    case "boolean":
      return typeof value === "boolean"
        ? { ok: true, value }
        : { ok: false, msg: `${name} must be boolean` };
    case "string":
      if (typeof value !== "string") return { ok: false, msg: `${name} must be string` };
      if (value.length > 256) return { ok: false, msg: `${name} string too long` };
      return { ok: true, value };
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value))
        return { ok: false, msg: `${name} must be number` };
      if (value < -1e6 || value > 1e6) return { ok: false, msg: `${name} number out of range` };
      return { ok: true, value };
    case "rollout":
      return typeof value === "boolean"
        ? { ok: true, value }
        : { ok: false, msg: `${name} (rollout) requires boolean value` };
    default:
      return { ok: false, msg: `Unsupported type for ${name}` };
  }
}

export async function POST(req: Request) {
  const token = req.headers.get("x-ff-admin-token");
  const expected = process.env.FF_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Admin API disabled" }, { status: 503 });
  }
  if (!token) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await readJsonWithLimit(req, 1024);
  if (!body.ok) return body.res;
  const { flag, value, ttlSeconds, reason } = body.data || ({} as Payload);

  if (typeof flag !== "string" || flag.length === 0) {
    return NextResponse.json({ error: "flag is required" }, { status: 400 });
  }
  if (typeof reason !== "undefined" && (typeof reason !== "string" || reason.length > 256)) {
    return NextResponse.json({ error: "reason must be string ≤ 256" }, { status: 400 });
  }
  const ttl = clamp(Number(ttlSeconds ?? 3600), 1, 86400);
  const validation = validateByRegistry(flag, value);
  if (!validation.ok) {
    return NextResponse.json({ error: "Invalid value", details: validation.msg }, { status: 400 });
  }

  try {
    const { expiresAt } = setGlobal(flag, validation.value, ttl, reason);
    logAdminAction({
      timestamp: Date.now(),
      actor: "admin",
      action: "global_override_set",
      flag,
      value: validation.value,
      ttlSeconds: ttl,
      reason,
    });
    return NextResponse.json(
      {
        ok: true,
        flag,
        value,
        ttlSeconds: ttl,
        expiresAt,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
