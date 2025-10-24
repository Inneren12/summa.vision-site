import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { validateFeatureFlagsEnvString, validateFeatureFlagsObject } from "@/lib/ff/schema";

describe("FEATURE_FLAGS_JSON schema validation", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "test";
  });
  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(env)) {
      delete env[key];
    }
    Object.assign(process.env, saved);
  });

  it("accepts empty or missing ENV", () => {
    const r1 = validateFeatureFlagsEnvString(undefined);
    expect(r1.ok).toBe(true);
    const r2 = validateFeatureFlagsEnvString("");
    expect(r2.ok).toBe(true);
  });

  it("detects malformed JSON", () => {
    const r = validateFeatureFlagsEnvString("{oops");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/malformed/i);
  });

  it("validates types per registry", () => {
    const obj = {
      betaUI: true,
      maxItems: 10,
      bannerText: "hello",
      newCheckout: { enabled: true, percent: 25, salt: "s1" },
    };
    const r = validateFeatureFlagsObject(obj);
    expect(r.ok).toBe(true);
  });

  it("reports errors for invalid rollout/variant", () => {
    const obj = {
      newCheckout: { enabled: "yes", percent: 200 }, // errors
      uiExperiment: { variants: { A: -10, B: 20 } }, // errors
    };
    const r = validateFeatureFlagsObject(obj);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/enabled.*boolean/i);
    expect(r.errors.join(" ")).toMatch(/percent.*range/i);
    expect(r.errors.join(" ")).toMatch(/non-negative/i);
  });

  it("warns for unknown ENV flags (no content leak)", () => {
    const obj = { doesNotExist: true };
    const r = validateFeatureFlagsObject(obj);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/Unknown flag/i);
  });
});
