import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getFeatureFlagsFromHeaders } from "../../lib/ff/server";

describe("server flags merge with overrides cookie", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, savedEnv);
    process.env.NODE_ENV = "test";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      feature: { enabled: true, percent: 25 },
      on: false,
      msg: "hello",
    });
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("overrides(cookie) win over ENV", async () => {
    const cookieHeader =
      "sv_flags_override=" + encodeURIComponent(JSON.stringify({ on: true, msg: "over" }));
    const flags = await getFeatureFlagsFromHeaders({ cookie: cookieHeader });
    expect(flags.on).toBe(true);
    expect(flags.msg).toBe("over");
    expect(flags.feature).toEqual({ enabled: true, percent: 25 });
  });
});
