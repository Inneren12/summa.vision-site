import { describe, it, expect } from "vitest";

import { fnv1a32, inRollout } from "../../lib/ff/hash";

describe("percent rollout hashing", () => {
  it("edge cases 0% and 100%", () => {
    expect(inRollout("any", 0, "salt")).toBe(false);
    expect(inRollout("any", 100, "salt")).toBe(true);
  });

  it("deterministic for same id/salt", () => {
    const result = inRollout("user_abc", 25, "s1");
    expect(result).toBe(inRollout("user_abc", 25, "s1"));
  });

  it("different salts change bucket", () => {
    expect(fnv1a32("s1:user_abc")).not.toBe(fnv1a32("s2:user_abc"));
  });

  it("distribution ~25% ±0.5% over 10k samples per segment", () => {
    const segmentSize = 10_000;
    const segments = 10; // 10 x 10k = 100k total samples for stability
    const total = segmentSize * segments;
    const p = 25;
    const tol = 0.5;
    const rand = (() => {
      let a = 0x12345678;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    let count = 0;
    for (let segment = 0; segment < segments; segment += 1) {
      for (let i = 0; i < segmentSize; i += 1) {
        let stableId = "";
        for (let j = 0; j < 32; j += 1) {
          stableId += Math.floor(rand() * 16)
            .toString(16)
            .toUpperCase();
        }
        if (inRollout(stableId, p, `salt-${segment}`)) count += 1;
      }
    }
    const actual = (count / total) * 100;
    expect(actual).toBeGreaterThanOrEqual(p - tol);
    expect(actual).toBeLessThanOrEqual(p + tol);
  });
});
