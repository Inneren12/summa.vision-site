import { afterEach, describe, expect, it, vi } from "vitest";

async function loadBucketing(strategy?: string) {
  if (strategy === undefined) {
    delete process.env.FF_BUCKET_STRATEGY;
  } else {
    process.env.FF_BUCKET_STRATEGY = strategy;
  }
  const envModule = await import("@/lib/env/load");
  envModule.__resetEnvCache();
  const bucketing = await import("@/lib/ff/bucketing");
  bucketing.__resetBucketStrategyCache();
  return bucketing;
}

function ksStatistic(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const empirical = (i + 1) / n;
    const uniform = sorted[i];
    const diff = Math.abs(empirical - uniform);
    if (diff > d) d = diff;
  }
  return d;
}

describe("bucketing", () => {
  afterEach(() => {
    delete process.env.FF_BUCKET_STRATEGY;
  });

  it("produces near-uniform distribution for murmur3", async () => {
    const { hashToUnit } = await loadBucketing();
    const n = 10_000;
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
      values.push(hashToUnit(`seed:${i}`));
    }
    const statistic = ksStatistic(values);
    expect(statistic).toBeLessThanOrEqual(0.02);
  });

  it("approximates target percent with pctHit", async () => {
    const { pctHit } = await loadBucketing();
    const trials = 20_000;
    const percent = 37;
    let hits = 0;
    for (let i = 0; i < trials; i++) {
      if (pctHit(`trial:${i}`, percent)) hits += 1;
    }
    const observed = hits / trials;
    expect(observed).toBeGreaterThan(0.3);
    expect(observed).toBeLessThan(0.44);
  });

  it("switches strategies based on env config", async () => {
    const defaultModule = await loadBucketing();
    const defaultValue = defaultModule.hashToUnit("strategy-check");

    const altModule = await loadBucketing("xxhash32");
    const altValue = altModule.hashToUnit("strategy-check");

    expect(altValue).not.toBe(defaultValue);
  });

  it("falls back to default strategy when unknown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallbackModule = await loadBucketing("unknown");
    const fallbackValue = fallbackModule.hashToUnit("fallback");
    const defaultModule = await loadBucketing();
    const defaultValue = defaultModule.hashToUnit("fallback");
    expect(fallbackValue).toBe(defaultValue);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
