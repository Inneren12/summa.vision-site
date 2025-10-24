import { describe, expect, it } from "vitest";

import { inRolloutByUnit } from "@/lib/ff/hash";
import { chooseVariant, validateOrNormalizeWeights } from "@/lib/ff/variant";

function makeRng(seed = 123456789) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

describe("Randomized properties", () => {
  it("normalizes weights to 100 in non-strict mode", () => {
    const rand = makeRng(42);
    for (let i = 0; i < 50; i++) {
      const weights = {
        A: Math.floor(rand() * 100),
        B: Math.floor(rand() * 100),
        C: Math.floor(rand() * 100),
      };
      const result = validateOrNormalizeWeights(weights, false);
      expect(result.ok).toBe(true);
      const sum = Object.values(result.weights).reduce((acc, value) => acc + value, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1e-6);
      const chosen = chooseVariant("user-1", "salt", result.weights);
      expect(["A", "B", "C"]).toContain(chosen);
    }
  });

  it("handles 0% and 100% rollouts", () => {
    expect(inRolloutByUnit(0.999, 0)).toBe(false);
    expect(inRolloutByUnit(0, 100)).toBe(true);
  });
});
