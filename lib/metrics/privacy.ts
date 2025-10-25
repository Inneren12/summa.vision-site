export type ConsentLevel = "all" | "necessary";

function normalize(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function parseCookies(headers: Headers): Record<string, string> {
  const header = headers.get("cookie");
  if (!header) return {};
  const jar: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    try {
      jar[key] = decodeURIComponent(value);
    } catch {
      jar[key] = value;
    }
  }
  return jar;
}

export function readConsent(headers: Headers): ConsentLevel {
  const header = normalize(headers.get("x-consent"));
  if (header === "all") return "all";
  if (header === "necessary") return "necessary";
  const cookies = parseCookies(headers);
  const cookie = normalize(cookies["sv_consent"] ?? null);
  if (cookie === "all") return "all";
  if (cookie === "necessary") return "necessary";
  return "necessary";
}

const DNT_ENABLED_VALUES = new Set(["1", "yes"]);

export function hasDoNotTrackEnabled(headers: Headers): boolean {
  const dnt = normalize(headers.get("dnt"));
  if (DNT_ENABLED_VALUES.has(dnt)) return true;
  const xDnt = normalize(headers.get("x-do-not-track"));
  if (DNT_ENABLED_VALUES.has(xDnt)) return true;
  const gpc = normalize(headers.get("sec-gpc"));
  if (DNT_ENABLED_VALUES.has(gpc)) return true;
  return false;
}

const SENSITIVE_KEYS = new Set(["url", "message", "stack", "filename"]);

export function readIdentifiers(headers: Headers): { sid?: string; aid?: string } {
  const cookies = parseCookies(headers);
  const sid = (headers.get("x-sid") || cookies["ff_aid"] || cookies["sv_id"] || "").trim();
  const aid = (
    headers.get("x-aid") ||
    cookies["ff_aid"] ||
    cookies["sv_aid"] ||
    cookies["aid"] ||
    ""
  ).trim();
  return {
    sid: sid || undefined,
    aid: aid || undefined,
  };
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      sanitized[key] = redactValue(val);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeAttribution(
  consent: ConsentLevel,
  attribution: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attribution) return undefined;
  if (consent !== "necessary") return attribution;
  const sanitized = redactValue(attribution) as Record<string, unknown>;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeMessage(
  consent: ConsentLevel,
  value: string | undefined,
): string | undefined {
  if (consent === "necessary") return undefined;
  return value ?? "Unknown error";
}

export function sanitizeStack(
  consent: ConsentLevel,
  stack: string | undefined,
): string | undefined {
  if (consent === "necessary") return undefined;
  return stack;
}

export function sanitizeUrl(consent: ConsentLevel, url: string | undefined): string | undefined {
  if (consent === "necessary") return undefined;
  return url;
}

export function sanitizeFilename(
  consent: ConsentLevel,
  filename: string | undefined,
): string | undefined {
  if (consent === "necessary") return undefined;
  return filename;
}
