import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFlagsServer } from "@/lib/ff/effective.server";

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
