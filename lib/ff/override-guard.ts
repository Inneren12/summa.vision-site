import { inc } from "./metrics";
import { parseXForwardedFor } from "./net";
import { isSameSiteRequest } from "./origin";
import { parseCookieHeader } from "./overrides";
import { allow } from "./ratelimit";
import { tscmp } from "./tscmp";

export type GuardDecision =
  | { allow: true }
  | {
      allow: false;
      code: number;
      body: { error: string; retryAfter?: number };
      headers?: Record<string, string>;
    };

function parseOverrideRpm(): number {
  const raw = process.env.ADMIN_RATE_LIMIT_OVERRIDE_RPM ?? process.env.FF_OVERRIDE_RPM;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 10;
  }
  if (parsed <= 0) return 0;
  return Math.min(Math.max(1, parsed), 240);
}

/** Preflight for /api/ff-override: rate limit + prod tester token. */
export async function guardOverrideRequest(req: Request): Promise<GuardDecision> {
  const rpm = parseOverrideRpm();
  const requireToken = process.env.NODE_ENV === "production";
  const testerToken = process.env.FF_TESTER_TOKEN;

  // IP for rate-limiting
  const rawXff = req.headers.get("x-forwarded-for");
  const parsedIp = parseXForwardedFor(rawXff);
  const clientIp = parsedIp === "unknown" ? (req.headers.get("x-real-ip") ?? "unknown") : parsedIp;
  const cookieJar = req.headers.get("cookie") || "";
  const jar = parseCookieHeader(cookieJar);
  const stable = jar["ff_aid"] || "noaid";

  if (rpm > 0) {
    const rlKey = `ff-override:${clientIp}:${stable}`;
    const { ok, resetIn } = await allow(rlKey, rpm);
    if (!ok) {
      inc("override.429");
      const retry = Math.max(1, Math.ceil(resetIn / 1000));
      console.warn(
        `[OverrideGuard] rate limit exceeded (rpm=${rpm}) for ip=${clientIp} stable=${stable}, retry in ${retry}s`,
      );
      return {
        allow: false,
        code: 429,
        body: { error: "Too many requests", retryAfter: retry },
        headers: { "Retry-After": String(retry) },
      };
    }
  }

  if (process.env.NODE_ENV === "production") {
    if (!isSameSiteRequest(req)) {
      inc("override.403.crossSite");
      return { allow: false, code: 403, body: { error: "Cross-site not allowed" } };
    }
  }

  if (requireToken) {
    const token = req.headers.get("x-ff-tester");
    if (!token || !tscmp(token, testerToken)) {
      inc("override.403");
      return { allow: false, code: 403, body: { error: "Tester token required" } };
    }
  }

  return { allow: true };
}
