import { beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/ff-override/route";
import { __resetMetrics, snapshot } from "@/lib/ff/metrics";
import { guardOverrideRequest } from "@/lib/ff/override-guard";

function makeRequest(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

describe("Metrics counters", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, originalEnv);
    __resetMetrics();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, originalEnv);
    __resetMetrics();
  });

  it("increments 429 on rate limiting", () => {
    process.env.FF_OVERRIDE_RPM = "1";
    const first = guardOverrideRequest(
      makeRequest("http://localhost/api/ff-override?ff=a:true", { "x-forwarded-for": "1.1.1.1" }),
    );
    const second = guardOverrideRequest(
      makeRequest("http://localhost/api/ff-override?ff=a:true", { "x-forwarded-for": "1.1.1.1" }),
    );
    expect(first.allow).toBe(true);
    expect(second.allow).toBe(false);
    const counters = snapshot();
    expect(counters["override.429"]).toBe(1);
  });

  it("increments 403 metrics in guard", () => {
    process.env.NODE_ENV = "production";
    process.env.FF_TESTER_TOKEN = "secret";
    process.env.ORIGIN = "http://localhost";
    const req = makeRequest("http://localhost/api/ff-override?ff=a:true", {
      origin: "http://localhost",
      referer: "http://localhost/dev",
    });
    const denied = guardOverrideRequest(req);
    expect(denied.allow).toBe(false);
    const counters = snapshot();
    expect(counters["override.403"]).toBe(1);
  });

  it("increments 403 cross-site metrics", () => {
    process.env.NODE_ENV = "production";
    process.env.ORIGIN = "http://localhost";
    const req = makeRequest("http://localhost/api/ff-override?ff=a:true", {
      origin: "https://evil.example",
    });
    const denied = guardOverrideRequest(req);
    expect(denied.allow).toBe(false);
    const counters = snapshot();
    expect(counters["override.403.crossSite"]).toBe(1);
  });

  it("increments unknown/type counters via API", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true });
    process.env.NODE_ENV = "production";
    process.env.FF_TESTER_TOKEN = "secret";
    const unknown = await GET(
      makeRequest("http://localhost/api/ff-override?ff=unknown:true", {
        "x-ff-tester": "secret",
      }),
    );
    expect(unknown.status).toBe(400);
    process.env.NODE_ENV = "test";
    const invalidType = await GET(
      makeRequest("http://localhost/api/ff-override?ff=betaUI:123", {}),
    );
    expect(invalidType.status).toBe(400);
    const counters = snapshot();
    expect(counters["override.400.unknown"]).toBeGreaterThanOrEqual(1);
    expect(counters["override.400.type"]).toBeGreaterThanOrEqual(1);
  });
});
