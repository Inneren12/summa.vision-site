import { AnyEvent } from "@/lib/analytics/schema";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_KEY_PATTERN = /(^|[_\-.\s])(phone|tel|mobile|msisdn|whats?app|contact)/i;

const QUERY_KEYS = new Set([
  "query",
  "search",
  "searchparams",
  "querystring",
  "searchparamsstring",
]);

const URL_KEY_SUFFIXES = ["url", "uri", "href", "referrer"];

const URL_REDACTED = "[redacted_url]" as const;
const EMAIL_REDACTED = "[redacted_email]" as const;
const PHONE_REDACTED = "[redacted_phone]" as const;
const QUERY_REDACTED = "" as const;

const isUrlKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  if (URL_KEY_SUFFIXES.some((suffix) => normalized === suffix)) {
    return true;
  }
  return URL_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const isQueryKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  if (QUERY_KEYS.has(normalized)) {
    return true;
  }
  return normalized.endsWith("query") || normalized.endsWith("searchparams");
};

const stripUrlQuery = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const queryIndex = trimmed.indexOf("?");
  const hashIndex = trimmed.indexOf("#");

  let end = trimmed.length;
  if (queryIndex >= 0) {
    end = Math.min(end, queryIndex);
  }
  if (hashIndex >= 0) {
    end = Math.min(end, hashIndex);
  }

  return trimmed.slice(0, end);
};

const TIME_KEYS = new Set([
  "ts",
  "time",
  "timestamp",
  "date",
  "datetime",
  "created_at",
  "updated_at",
]);

const isIsoLike = (candidate: string): boolean => {
  if (!/\d{4}-\d{2}-\d{2}/.test(candidate)) {
    return false;
  }
  return /[T ]\d{2}:\d{2}/.test(candidate) || /Z$/.test(candidate);
};

const looksLikePhone = (candidate: string): boolean => {
  const digits = (candidate.match(/\d/g) || []).length;
  if (digits < 10 || digits > 15) {
    return false;
  }
  if (isIsoLike(candidate)) {
    return false;
  }
  const normalized = candidate.replace(/\u00A0/g, " ");
  return /^(?:\+|00)?\d(?:[()\s.-]*\d){6,14}$/.test(normalized);
};

const sanitizeString = (candidate: string, key?: string): string => {
  const normalizedKey = key?.toLowerCase() ?? "";

  if (normalizedKey && isQueryKey(normalizedKey)) {
    return QUERY_REDACTED;
  }

  let result = candidate;
  if (normalizedKey && isUrlKey(normalizedKey)) {
    result = stripUrlQuery(result);
    if (!result) {
      return URL_REDACTED;
    }
  }

  if (EMAIL_PATTERN.test(result)) {
    return isUrlKey(normalizedKey) ? URL_REDACTED : EMAIL_REDACTED;
  }

  if (normalizedKey && TIME_KEYS.has(normalizedKey)) {
    return result;
  }

  if (normalizedKey && PHONE_KEY_PATTERN.test(normalizedKey) && looksLikePhone(result)) {
    return PHONE_REDACTED;
  }

  if (!normalizedKey && looksLikePhone(result)) {
    return PHONE_REDACTED;
  }

  return result;
};

const scrubPII = <T>(payload: T): T => {
  if (payload === null || typeof payload !== "object") {
    return payload;
  }

  const seen = new WeakMap<object, unknown>();

  const sanitize = (value: unknown, key?: string): unknown => {
    if (typeof value === "string") {
      return sanitizeString(value, key);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => sanitize(entry, key));
    }

    if (value && typeof value === "object") {
      const existing = seen.get(value as object);
      if (existing) {
        return existing;
      }

      const clone: Record<string, unknown> = {};
      seen.set(value as object, clone);
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        clone[innerKey] = sanitize(innerValue, innerKey);
      }
      return clone;
    }

    return value;
  };

  return sanitize(payload) as T;
};

export async function POST(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const batch = Array.isArray(body) ? body : [body];
  let acceptedCount = 0;

  for (const rawEvent of batch) {
    if (!rawEvent || typeof rawEvent !== "object") {
      continue;
    }

    const sanitized = scrubPII(rawEvent);
    const result = AnyEvent.safeParse(sanitized);

    if (result.success) {
      acceptedCount += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.info(`[analytics] accepted ${acceptedCount} event${acceptedCount === 1 ? "" : "s"}`);

  return new Response(null, { status: 204 });
}
