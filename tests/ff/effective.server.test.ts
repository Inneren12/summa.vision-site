import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { resolveEffectiveFlags } from "../../lib/ff/effective.shared";
import { type FeatureFlags } from "../../lib/ff/shared";

describe("resolveEffectiveFlags", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    }
    Object.assign(process.env, saved);
  });

  it("rollout: boolean override forces result", () => {
    const merged: FeatureFlags = {
      newCheckout: { enabled: true, percent: 25 }, // ENV
      betaUI: false,
    };
    // override will be applied before resolve; here we simulate boolean already merged
    merged.newCheckout = true;
    const eff = resolveEffectiveFlags("user_a", merged);
    expect(eff.newCheckout).toBe(true);
  });

  it("rollout: enabled=false disables regardless of percent", () => {
    const merged: FeatureFlags = { newCheckout: { enabled: false, percent: 50 } };
    const eff = resolveEffectiveFlags("user_b", merged);
    expect(eff.newCheckout).toBe(false);
  });

  it("rollout: percent from ENV yields deterministic inclusion", () => {
    const merged: FeatureFlags = { newCheckout: { enabled: true, percent: 100 } };
    const eff = resolveEffectiveFlags("user_c", merged);
    expect(eff.newCheckout).toBe(true);
  });

  it("primitive flags fall back to defaults on type mismatch", () => {
    const merged: FeatureFlags = { betaUI: "str", maxItems: "x", bannerText: 123 };
    const eff = resolveEffectiveFlags("user_d", merged);
    expect(typeof eff.betaUI).toBe("boolean");
    expect(typeof eff.maxItems).toBe("number");
    expect(typeof eff.bannerText).toBe("string");
  });
});
