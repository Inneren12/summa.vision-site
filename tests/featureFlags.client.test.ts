import { describe, it, expect } from "vitest";

import { getFeatureFlags, getFlag } from "../lib/ff/client";

describe("client flags from NEXT_PUBLIC_FEATURE_FLAGS_JSON", () => {
  it("parses structured and primitive values", () => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS_JSON = JSON.stringify({
      a: true,
      n: 3,
      s: "x",
      newCheckout: { enabled: false },
    });
    const flags = getFeatureFlags();
    expect(flags).toEqual({ a: true, n: 3, s: "x", newCheckout: { enabled: false } });

    expect(getFlag<boolean>("a")).toBe(true);
    expect(getFlag<number>("n")).toBe(3);
    expect(getFlag<string>("missing", "fallback")).toBe("fallback");
  });

  it("empty when env not set", () => {
    delete process.env.NEXT_PUBLIC_FEATURE_FLAGS_JSON;
    const flags = getFeatureFlags();
    expect(flags).toEqual({});
  });
});
