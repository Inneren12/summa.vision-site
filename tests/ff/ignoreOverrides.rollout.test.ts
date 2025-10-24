import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { resolveEffectiveFlags } from "../../lib/ff/effective.shared";
import { getFeatureFlagsFromHeaders } from "../../lib/ff/server";

describe("ignoreOverrides for protected rollout flags", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, originalEnv);
    process.env.NODE_ENV = "test";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      protectedRollout: { enabled: true, percent: 0 },
      newCheckout: { enabled: true, percent: 0 },
    });
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("boolean override is ignored for protectedRollout but honored for newCheckout", async () => {
    const cookieHeader =
      "sv_flags_override=" +
      encodeURIComponent(
        JSON.stringify({
          protectedRollout: true,
          newCheckout: true,
        }),
      );
    const merged = await getFeatureFlagsFromHeaders({ cookie: cookieHeader });
    const eff = resolveEffectiveFlags("user_x", merged);
    expect(eff.protectedRollout).toBe(false);
    expect(eff.newCheckout).toBe(true);
  });
});
