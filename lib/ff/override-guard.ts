import { parseXForwardedFor } from "./net";
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
  const rpm = Number(process.env.FF_OVERRIDE_RPM ?? 10);
  const requireToken = process.env.NODE_ENV === "production";
  const testerToken = process.env.FF_TESTER_TOKEN;

  // IP for rate-limiting
  const rawXff = req.headers.get("x-forwarded-for");
  const clientIp = parseXForwardedFor(rawXff) || (req.headers.get("x-real-ip") ?? "unknown");
  const { ok, resetIn } = allow(`ff-override:${clientIp}`, rpm);
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
