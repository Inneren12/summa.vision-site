// In-memory global overrides (per-process) with TTL and capacity limit.
export type GlobalValue = boolean | string | number;
type Entry = { value: GlobalValue; exp: number; reason?: string };

const MAX_DEFAULT = 100;
const MAX = clamp(Number(process.env.FF_GLOBAL_OVERRIDES_MAX ?? MAX_DEFAULT), 1, 1000);
const STORE: Record<string, Entry> = Object.create(null);

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function now() {
  return Date.now();
}

function pruneExpired() {
  const t = now();
  for (const k of Object.keys(STORE)) {
    if (STORE[k].exp <= t) delete STORE[k];
  }
}

export function setGlobal(
  name: string,
  value: GlobalValue,
  ttlSec: number,
  reason?: string,
): { expiresAt: number } {
  pruneExpired();
  const count = Object.keys(STORE).length;
  if (!Object.prototype.hasOwnProperty.call(STORE, name) && count >= MAX) {
    throw new Error(`Global overrides capacity exceeded (${MAX})`);
  }
  const ttl = clamp(Math.floor(ttlSec), 1, 86400); // 1s..24h
  const exp = now() + ttl * 1000;
  STORE[name] = { value, exp, reason };
  return { expiresAt: exp };
}

/** Read active global overrides as plain object (expired entries are pruned). */
export function readGlobals(): Record<string, GlobalValue> {
  pruneExpired();
  const out: Record<string, GlobalValue> = Object.create(null);
  for (const [k, e] of Object.entries(STORE)) out[k] = e.value;
  return out;
}

/** Tests-only utilities */
export function __resetGlobals() {
  for (const k of Object.keys(STORE)) delete STORE[k];
}
export function __countGlobals(): number {
  pruneExpired();
  return Object.keys(STORE).length;
}
