import { NextResponse } from "next/server";

import type { Role } from "./rbac";

import { parseXForwardedFor } from "@/lib/ff/net";
import { allow } from "@/lib/ff/ratelimit";

export type AdminRateLimitScope = "override" | "rollout-step" | "kill" | "telemetry-export";

export type AdminRateLimitDecision =
  | { ok: true }
  | {
      ok: false;
      response: NextResponse;
    };

function parseRpm(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed <= 0) return 0;
  return Math.min(Math.max(1, parsed), 600);
}

export function resolveRolloutStepRpm(): number {
  return parseRpm(process.env.ADMIN_RATE_LIMIT_ROLLOUT_STEP_RPM, 5);
}

export function resolveKillSwitchRpm(): number {
  return parseRpm(process.env.ADMIN_RATE_LIMIT_KILL_RPM, 2);
}

export function resolveOverrideRpm(): number {
  return parseRpm(process.env.ADMIN_RATE_LIMIT_OVERRIDE_RPM, 20);
}

export function resolveTelemetryExportRpm(): number {
  return parseRpm(process.env.ADMIN_RATE_LIMIT_TELEMETRY_EXPORT_RPM, 2);
}

export type AdminRateLimitActor = {
  role: Role;
  session?: string;
};

export async function enforceAdminRateLimit(options: {
  req: Request;
  scope: AdminRateLimitScope;
  rpm: number;
  actor?: AdminRateLimitActor;
}): Promise<AdminRateLimitDecision> {
  const { req, scope, rpm, actor } = options;
  if (!Number.isFinite(rpm) || rpm <= 0) {
    return { ok: true };
  }

  const rawXff = req.headers.get("x-forwarded-for");
  const parsedIp = parseXForwardedFor(rawXff);
  const clientIp = parsedIp === "unknown" ? (req.headers.get("x-real-ip") ?? "unknown") : parsedIp;
  const identifier = actor?.session || actor?.role || clientIp || "unknown";
  const key = `rl:admin:${scope}:${identifier}`;
  const result = await allow(key, rpm);
  if (result.ok) {
    return { ok: true };
  }

  const retry = Math.max(1, Math.ceil(result.resetIn / 1000));
  console.warn(
    `[AdminRateLimit] scope=${scope} denied for actor=${identifier} ip=${clientIp} (rpm=${rpm}), retry in ${retry}s`,
  );
  const response = NextResponse.json(
    { error: "Too many requests", scope, retryAfter: retry },
    { status: 429, headers: { "Retry-After": String(retry) } },
  );
  response.headers.set("cache-control", "no-store");
  return { ok: false, response };
}
