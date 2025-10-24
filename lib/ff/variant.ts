// Deterministic A/B/N choice based on stableId + salt using fast non-crypto FNV-1a 32-bit.

function fnv1a32(str: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Map hash to [0, 1). */
function unitInterval(s: string): number {
  const h = fnv1a32(s);
  // 2^32 = 4294967296
  return (h >>> 0) / 4294967296;
}

export function unitFromVariantSalt(stableId: string, salt: string): number {
  return unitInterval(`${salt}:${stableId}`);
}

/** Validate weights: all non-negative, finite, sum == 100 (prod) or normalize (dev). */
export function validateOrNormalizeWeights(
  weights: Record<string, number>,
  strict: boolean,
): { ok: true; weights: Record<string, number> } | { ok: false; error: string } {
  const entries = Object.entries(weights);
  if (entries.length === 0) return { ok: false, error: "No variants provided" };
  for (const [k, v] of entries) {
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: `Invalid weight for "${k}"` };
  }
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (strict) {
    if (Math.abs(sum - 100) > 1e-9)
      return { ok: false, error: `Weights must sum to 100 (got ${sum})` };
    return { ok: true, weights };
  }
  // normalize to 100 in non-strict mode
  if (sum === 0) return { ok: false, error: "Weights sum to 0" };
  const factor = 100 / sum;
  const normalized: Record<string, number> = {};
  for (const [k, v] of entries) normalized[k] = v * factor;
  return { ok: true, weights: normalized };
}

/** Deterministic variant chooser. */
export function chooseVariant<T extends string>(
  stableId: string,
  salt: string,
  weights: Record<T, number>,
): T {
  const list = Object.entries(weights) as [T, number][];
  // cumulative buckets in [0,100)
  let acc = 0;
  const buckets = list.map(([name, w]) => {
    const from = acc;
    acc += w;
    return { name, from, to: acc };
  });
  const r = unitInterval(`${salt}:${stableId}`) * 100;
  for (const b of buckets) if (r >= b.from && r < b.to) return b.name;
  // fallback (edge case due to float error)
  return buckets[buckets.length - 1]!.name;
}

/** Deterministic chooser using precomputed unit in [0,1). */
export function chooseVariantByUnit<T extends string>(unit: number, weights: Record<T, number>): T {
  const list = Object.entries(weights) as [T, number][];
  let acc = 0;
  const buckets = list.map(([name, w]) => {
    const from = acc;
    acc += w;
    return { name, from, to: acc };
  });
  const r = unit * 100;
  for (const b of buckets) if (r >= b.from && r < b.to) return b.name;
  return buckets[buckets.length - 1]!.name;
}
