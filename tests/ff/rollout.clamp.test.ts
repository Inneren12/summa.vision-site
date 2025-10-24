import { describe, it, expect } from "vitest";

import { resolveEffectiveFlag } from "@/lib/ff/effective.shared";

describe("rollout percent clamp", () => {
  const NAME = "newCheckout" as const;
  const STABLE = "test-user";

  it("percent > 100 behaves as 100 (always true when enabled)", () => {
    const value = resolveEffectiveFlag(NAME, { enabled: true, percent: 101, salt: "x" }, STABLE);
    expect(value).toBe(true);
  });

  it("percent < 0 behaves as 0 (always false when enabled)", () => {
    const value = resolveEffectiveFlag(NAME, { enabled: true, percent: -5, salt: "x" }, STABLE);
    expect(value).toBe(false);
  });
});
