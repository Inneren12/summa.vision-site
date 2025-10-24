import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { __resetServerEnvCacheForTests } from "@/lib/env.server";
import { perfGet, perfReset } from "@/lib/ff/perf";
import { getFeatureFlags, __resetFeatureFlagsCacheForTests } from "@/lib/ff/server";

const SAVED = { ...process.env };

describe("ENV parse cache", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    Object.keys(process.env).forEach((key) => delete mutableEnv[key]);
    Object.assign(process.env, SAVED);
    perfReset(["ff.env.parse"]);
    __resetServerEnvCacheForTests();
    __resetFeatureFlagsCacheForTests();
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => delete mutableEnv[key]);
    Object.assign(process.env, SAVED);
    perfReset();
    __resetServerEnvCacheForTests();
    __resetFeatureFlagsCacheForTests();
  });

  it("parses once for same FEATURE_FLAGS_JSON", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true });
    __resetServerEnvCacheForTests();
    await getFeatureFlags();
    await getFeatureFlags();
    expect(perfGet("ff.env.parse")).toBe(1);
  });

  it("re-parses after ENV change", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true });
    __resetServerEnvCacheForTests();
    await getFeatureFlags();
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: false });
    __resetServerEnvCacheForTests();
    await getFeatureFlags();
    expect(perfGet("ff.env.parse")).toBe(2);
  });
});
