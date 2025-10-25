import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/dev/flags-reload/route";
import { __resetEnvCache } from "@/lib/env/load";
import { getFeatureFlagsFromHeaders } from "@/lib/ff/server";

describe("Dev flags reload API", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, originalEnv);
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";
    __resetEnvCache();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, originalEnv);
    __resetEnvCache();
  });

  it("updates FEATURE_FLAGS_JSON when called", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: false });
    const before = await getFeatureFlagsFromHeaders();
    expect(before.betaUI).toBe(false);

    const response = await POST(
      new Request("http://localhost/api/dev/flags-reload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envJson: JSON.stringify({ betaUI: true }) }),
      }),
    );
    expect(response.status).toBe(200);

    const after = await getFeatureFlagsFromHeaders();
    expect(after.betaUI).toBe(true);
  });
});
