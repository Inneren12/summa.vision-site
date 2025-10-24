import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFlagsServer } from "@/lib/ff/effective.server";
import { inRollout, __hashCacheSize, __clearHashCache } from "@/lib/ff/hash";
import { perfGet, perfReset } from "@/lib/ff/perf";

describe("Rollout hash LRU cache", () => {
  beforeEach(() => {
    __clearHashCache();
    perfReset(["ff.rollout.hash.compute", "ff.rollout.cache.hit"]);
  });

  it("computes hash once and hits cache on repeats", () => {
    const id = "u:john";
    const salt = "featureA";
    const percent = 50;
    const r1 = inRollout(id, percent, salt);
    const r2 = inRollout(id, percent, salt);
    const r3 = inRollout(id, percent, salt);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(perfGet("ff.rollout.hash.compute")).toBe(1);
    expect(perfGet("ff.rollout.cache.hit")).toBeGreaterThanOrEqual(2);
    expect(__hashCacheSize()).toBe(1);
  });

  it("evicts when exceeding MAX_HASH_CACHE", () => {
    const salt = "x";
    for (let i = 0; i < 5100; i++) {
      inRollout(`u:${i}`, 50, salt);
    }
    expect(__hashCacheSize()).toBeLessThanOrEqual(5000);
  });
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    get: () => undefined,
  }),
}));

describe("Per-request rollout unit cache", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("produces stable outputs without changing semantics", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 50, salt: "s" },
      uiExperiment: {
        enabled: true,
        variants: { control: 50, treatment: 50 },
        salt: "v",
      },
    });

    const first = await getFlagsServer();
    const second = await getFlagsServer();

    expect(typeof first.newCheckout).toBe("boolean");
    expect(typeof first.uiExperiment).toBe("string");
    expect(typeof second.newCheckout).toBe("boolean");
    expect(typeof second.uiExperiment).toBe("string");
  });
});
