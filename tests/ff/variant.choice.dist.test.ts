import { describe, it, expect } from "vitest";

import { chooseVariant, validateOrNormalizeWeights } from "@/lib/ff/variant";

function sample(weights: Record<string, number>, n = 10000) {
  const counts: Record<string, number> = {};
  const norm = validateOrNormalizeWeights(weights, true);
  if (!norm.ok) throw new Error(norm.error);
  const ww = norm.weights;
  for (let i = 0; i < n; i++) {
    const id = `u:${i.toString().padStart(6, "0")}`;
    const v = chooseVariant(id, "salt", ww);
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const pct: Record<string, number> = {};
  for (const k of Object.keys(ww)) pct[k] = ((counts[k] ?? 0) / n) * 100;
  return pct;
}

describe("Variants distribution", () => {
  it("50/50 close to expected", () => {
    const pct = sample({ A: 50, B: 50 });
    expect(Math.abs(pct.A - 50)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(pct.B - 50)).toBeLessThanOrEqual(1.0);
  });
  it("10/20/70 close to expected", () => {
    const pct = sample({ A: 10, B: 20, C: 70 });
    expect(Math.abs(pct.A - 10)).toBeLessThanOrEqual(2.0);
    expect(Math.abs(pct.B - 20)).toBeLessThanOrEqual(2.0);
    expect(Math.abs(pct.C - 70)).toBeLessThanOrEqual(2.0);
  });
});
