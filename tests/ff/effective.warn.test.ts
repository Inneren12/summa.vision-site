import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveEffectiveFlags } from "../../lib/ff/effective.shared";
import type { FeatureFlags } from "../../lib/ff/shared";

describe("resolveEffectiveFlags warnings (robustness)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("warns when rollout flag receives a primitive (number) instead of RolloutConfig/boolean", () => {
    const merged: FeatureFlags = {
      // Неверный тип: число вместо {enabled,percent}
      newCheckout: 25 as unknown as FeatureFlags["newCheckout"],
    };
    const eff = resolveEffectiveFlags("user_warn", merged);
    // По реестру дефолт для newCheckout: {enabled:false} -> эффективное значение false
    expect(eff.newCheckout).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    const msg = (warnSpy.mock.calls[0]?.[0] ?? "") as string;
    expect(msg).toContain("Type mismatch");
    expect(msg).toContain("newCheckout");
  });

  it("does not warn when value is undefined (uses default silently)", () => {
    const merged: FeatureFlags = {};
    resolveEffectiveFlags("user_ok", merged);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
