import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFlagsServer, getFlagServer, getFlagServerWithMeta } from "@/lib/ff/effective.server";
import { __resetFeatureFlagsCacheForTests } from "@/lib/ff/server";

const ORIGINAL_ENV = { ...process.env };

vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    get: () => undefined,
  }),
}));

describe("getFlagServer (lazy single flag resolve)", () => {
  beforeEach(() => {
    __resetFeatureFlagsCacheForTests();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
    __resetFeatureFlagsCacheForTests();
  });

  it("resolves boolean flag equal to getFlagsServer()[name]", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true, bannerText: "Hello" });
    const all = await getFlagsServer();
    const single = await getFlagServer("betaUI");
    expect(single).toBe(all.betaUI);
  });

  it("is deterministic for rollout with same stableId", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 37, salt: "p1" },
    });
    const a = await getFlagServer("newCheckout", { userId: "john" });
    const b = await getFlagServer("newCheckout", { userId: "john" });
    expect(a).toBe(b);
  });

  it("exposes metadata with stableId and source", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true });
    const result = await getFlagServerWithMeta("betaUI");
    expect(result.value).toBe(true);
    expect(result.source).toBe("env");
    expect(result.stableId).toBeTruthy();
  });
});
