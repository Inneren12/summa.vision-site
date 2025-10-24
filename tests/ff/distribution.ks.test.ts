import { describe, expect, it } from "vitest";

import { unitFor } from "@/lib/ff/hash";

function ksStatistic(values: number[]): number {
  const normalized = values.map((x) => x / 100).sort((a, b) => a - b);
  const n = normalized.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const empirical = (i + 1) / n;
    const uniform = normalized[i];
    const diff = Math.abs(empirical - uniform);
    if (diff > d) d = diff;
  }
  return d;
}

describe("unitFor ~ Uniform(0,1) (KS test)", () => {
  it("KS statistic within tolerance for n=10000", () => {
    const salt = "ks-test";
    const n = 10000;
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
      values.push(unitFor(salt, `u:${i}`));
    }
    const statistic = ksStatistic(values);
    expect(statistic).toBeLessThanOrEqual(0.02);
  });
});
