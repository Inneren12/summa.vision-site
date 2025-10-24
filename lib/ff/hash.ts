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

/** Return true if stableId falls into rollout bucket for given percent [0..100]. */
export function inRollout(stableId: string, percent: number, salt = ""): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const h = fnv1a32(`${salt}:${stableId}`);
  const v = h / 2 ** 32; // [0, 1)
  return v < percent / 100;
}

/** FNV-1a derived unit value for salt + stableId pair. */
export function unitFromIdSalt(stableId: string, salt: string): number {
  const h = fnv1a32(`${salt}:${stableId}`);
  return h / 2 ** 32;
}

/** Rollout decision for precomputed unit. */
export function inRolloutByUnit(unit: number, percent: number): boolean {
  const clamped = Math.min(Math.max(percent, 0), 100);
  if (clamped <= 0) return false;
  if (clamped >= 100) return true;
  return unit * 100 < clamped;
}
