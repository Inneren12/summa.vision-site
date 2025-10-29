import { AnyEvent } from "@/lib/analytics/schema";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}/;

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

const sanitizeString = (key: string, value: string): string => {
  const normalizedKey = key.toLowerCase();

  if (isQueryKey(normalizedKey)) {
    return QUERY_REDACTED;
  }

  let candidate = value;
  if (isUrlKey(normalizedKey)) {
    candidate = stripUrlQuery(candidate);
    if (!candidate) {
      return URL_REDACTED;
    }
  }

  if (EMAIL_PATTERN.test(candidate)) {
    return isUrlKey(normalizedKey) ? URL_REDACTED : EMAIL_REDACTED;
  }

  if (PHONE_PATTERN.test(candidate)) {
    return PHONE_REDACTED;
  }

  return candidate;
};

const scrubPII = <T>(payload: T): T => {
  if (payload === null || typeof payload !== "object") {
    return payload;
  }

  return JSON.parse(
    JSON.stringify(payload, (key, value) => {
      if (typeof value === "string") {
        return sanitizeString(key, value);
      }
      return value;
    }),
  );
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
