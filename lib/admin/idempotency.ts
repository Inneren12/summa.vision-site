import { NextResponse } from "next/server";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/;
const MAX_STORE_ENTRIES = 500;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

type StoredResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: Uint8Array;
  expiresAt: number;
};

const STORE = new Map<string, StoredResponse>();

function invalidKey(reason: string): NextResponse {
  const res = NextResponse.json({ error: "Invalid Idempotency-Key", reason }, { status: 400 });
  res.headers.set("cache-control", "no-store");
  return res;
}

function resolveTtlMs(): number {
  const msRaw = process.env.ADMIN_IDEMPOTENCY_TTL_MS;
  if (msRaw) {
    const parsed = Number(msRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, 24 * 60 * 60 * 1000);
    }
  }
  const secRaw = process.env.ADMIN_IDEMPOTENCY_TTL_SECONDS;
  if (secRaw) {
    const parsed = Number(secRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed * 1000, 24 * 60 * 60 * 1000);
    }
  }
  return DEFAULT_TTL_MS;
}

function prune(now = Date.now()): void {
  for (const [key, entry] of STORE) {
    if (entry.expiresAt <= now) {
      STORE.delete(key);
    }
  }
  while (STORE.size > MAX_STORE_ENTRIES) {
    const oldest = STORE.keys().next().value;
    if (!oldest) break;
    STORE.delete(oldest);
  }
}

function buildResponse(entry: StoredResponse): NextResponse {
  const res = new NextResponse(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
  res.headers.set("x-idempotency-cache", "hit");
  return res;
}

async function persist(key: string, res: NextResponse): Promise<void> {
  const ttl = resolveTtlMs();
  if (!Number.isFinite(ttl) || ttl <= 0) {
    STORE.delete(key);
    return;
  }
  if (res.status >= 500) {
    STORE.delete(key);
    return;
  }
  const clone = res.clone();
  const buffer = await clone.arrayBuffer();
  const headers = Array.from(clone.headers.entries());
  STORE.set(key, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
    body: new Uint8Array(buffer),
    expiresAt: Date.now() + ttl,
  });
  prune();
  res.headers.set("x-idempotency-cache", "stored");
}

export type IdempotencyDecision =
  | { kind: "error"; response: NextResponse }
  | { kind: "hit"; response: NextResponse }
  | { kind: "proceed"; store(res: NextResponse): Promise<void> };

export function beginIdempotentRequest(req: Request): IdempotencyDecision {
  const rawKey = req.headers.get("idempotency-key");
  if (rawKey === null) {
    return { kind: "proceed", store: async () => {} };
  }
  const key = rawKey.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { kind: "error", response: invalidKey("format") };
  }
  prune();
  const existing = STORE.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return { kind: "hit", response: buildResponse(existing) };
  }
  return {
    kind: "proceed",
    async store(res: NextResponse) {
      await persist(key, res);
    },
  };
}

export function __resetAdminIdempotencyStore() {
  STORE.clear();
}
