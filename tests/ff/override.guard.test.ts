import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { guardOverrideRequest } from "../../lib/ff/override-guard";
import { __resetRateLimit } from "../../lib/ff/ratelimit";

describe("guardOverrideRequest (rate limit + tester token)", () => {
  const saved = { ...process.env };
  beforeEach(async () => {
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "development";
    delete process.env.FF_TESTER_TOKEN;
    process.env.FF_OVERRIDE_RPM = "3"; // make test fast
    await __resetRateLimit();
  });
  afterEach(async () => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(env)) {
      if (!(key in saved)) {
        delete env[key];
      }
    }
    Object.assign(process.env, saved);
    await __resetRateLimit();
  });

  function mkReq(headers: Record<string, string>) {
    return new Request("http://localhost/api/ff-override?ff=a:true", { headers });
  }

  it("allows up to RPM and then 429 with Retry-After", async () => {
    const req = mkReq({ "x-forwarded-for": "9.9.9.9" });
    expect((await guardOverrideRequest(req)).allow).toBe(true);
    expect((await guardOverrideRequest(req)).allow).toBe(true);
    const third = await guardOverrideRequest(req);
    expect(third.allow).toBe(true); // 3rd allowed (limit=3)
    const fourth = await guardOverrideRequest(req);
    expect(fourth.allow).toBe(false);
    if (!fourth.allow) {
      expect(fourth.code).toBe(429);
      expect(fourth.headers?.["Retry-After"]).toBeDefined();
    }
  });

  it("requires X-FF-Tester in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.FF_TESTER_TOKEN = "token123";
    const noToken = mkReq({ "x-forwarded-for": "1.1.1.1" });
    const denied = await guardOverrideRequest(noToken);
    expect(denied.allow).toBe(false);
    if (!denied.allow) expect(denied.code).toBe(403);

    const withToken = mkReq({ "x-forwarded-for": "1.1.1.1", "x-ff-tester": "token123" });
    const allowed = await guardOverrideRequest(withToken);
    expect(allowed.allow).toBe(true);
  });
});
