import { parseXForwardedFor } from "./net";
import { parseCookieHeader } from "./overrides";
import { allow } from "./ratelimit";

export type GuardDecision =
  | { allow: true }
  | {
      allow: false;
      code: number;
      body: { error: string; retryAfter?: number };
      headers?: Record<string, string>;
    };

/** Preflight for /api/ff-override: rate limit + prod tester token. */
export function guardOverrideRequest(req: Request): GuardDecision {
  const rawRpm = process.env.FF_OVERRIDE_RPM;
  let rpm = Number(rawRpm);
  if (!Number.isFinite(rpm)) rpm = 10;
  rpm = Math.min(Math.max(1, rpm), 120);
  const requireToken = process.env.NODE_ENV === "production";
  const testerToken = process.env.FF_TESTER_TOKEN;

  // IP for rate-limiting
  const rawXff = req.headers.get("x-forwarded-for");
  const clientIp = parseXForwardedFor(rawXff) || (req.headers.get("x-real-ip") ?? "unknown");
  const cookieJar = req.headers.get("cookie") || "";
  const jar = parseCookieHeader(cookieJar);
  const sv = jar["sv_id"] || "nosvid";
  const rlKey = `ff-override:${clientIp}:${sv}`;
  const { ok, resetIn } = allow(rlKey, rpm);
  if (!ok) {
    const retry = Math.ceil(resetIn / 1000);
    return {
      allow: false,
      code: 429,
      body: { error: "Too many requests", retryAfter: retry },
      headers: { "Retry-After": String(retry) },
    };
  }

  if (requireToken) {
    const token = req.headers.get("x-ff-tester");
    if (!token || token !== testerToken) {
      return { allow: false, code: 403, body: { error: "Tester token required" } };
    }
  }

  return { allow: true };
}
