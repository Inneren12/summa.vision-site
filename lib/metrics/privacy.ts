const REDACTED_VALUE = "[redacted]" as const;

export type ConsentLevel = "all" | "necessary";

function normalize(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function readConsent(headers: Headers): ConsentLevel {
  const header = normalize(headers.get("x-consent"));
  if (header === "all") return "all";
  if (header === "necessary") return "necessary";
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

const SENSITIVE_KEYS = new Set(["url", "message"]);

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

export function redactMessage(consent: ConsentLevel, value: string | undefined): string {
  if (consent === "necessary") {
    return REDACTED_VALUE;
  }
  return value ?? "Unknown error";
}

export function sanitizeStack(
  consent: ConsentLevel,
  stack: string | undefined,
): string | undefined {
  if (consent === "necessary") return undefined;
  return stack;
}

export { REDACTED_VALUE };
