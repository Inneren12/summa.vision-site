// In-memory rate limiter (per-process, Node runtime)
type Counter = { count: number; resetAt: number };
const BUCKET = new Map<string, Counter>();

export function allow(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const cur = BUCKET.get(key);
  if (!cur || cur.resetAt <= now) {
    BUCKET.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (cur.count >= limit) {
    return { ok: false, remaining: 0, resetIn: Math.max(0, cur.resetAt - now) };
  }
  cur.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - cur.count),
    resetIn: Math.max(0, cur.resetAt - now),
  };
}

// tests-only
export function __resetRateLimit() {
  BUCKET.clear();
}
