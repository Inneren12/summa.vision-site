import { perfInc } from "./perf";

// Fast non-crypto hash for percent rollout: FNV-1a 32-bit
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const MAX_HASH_CACHE = 5000;
const HASH_CACHE = new Map<string, number>();

function cacheGet(key: string): number | undefined {
  const v = HASH_CACHE.get(key);
  if (v === undefined) return undefined;
  HASH_CACHE.delete(key);
  HASH_CACHE.set(key, v);
  perfInc("ff.rollout.cache.hit");
  return v;
}

function cacheSet(key: string, val: number) {
  HASH_CACHE.set(key, val);
  if (HASH_CACHE.size > MAX_HASH_CACHE) {
    const first = HASH_CACHE.keys().next().value;
    if (first) HASH_CACHE.delete(first);
  }
}

/** Вернуть unit (0..100) для пары salt+stableId с кэшированием. */
export function unitFor(salt: string, stableId: string): number {
  const key = `${salt}|${stableId}`;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  perfInc("ff.rollout.hash.compute");
  const unit = (fnv1a32(`${salt}:${stableId}`) / 2 ** 32) * 100;
  cacheSet(key, unit);
  return unit;
}

/** Return true if stableId falls into rollout bucket for given percent [0..100]. */
export function inRollout(stableId: string, percent: number, salt = ""): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const unit = unitFor(salt, stableId);
  return unit < percent;
}

/** FNV-1a derived unit value for salt + stableId pair (0..1). */
export function unitFromIdSalt(stableId: string, salt: string): number {
  return unitFor(salt, stableId) / 100;
}

/** Rollout decision for precomputed unit. */
export function inRolloutByUnit(unit: number, percent: number): boolean {
  const clamped = Math.min(Math.max(percent, 0), 100);
  if (clamped <= 0) return false;
  if (clamped >= 100) return true;
  return unit * 100 < clamped;
}

export function __hashCacheSize() {
  return HASH_CACHE.size;
}

export function __clearHashCache() {
  HASH_CACHE.clear();
}
