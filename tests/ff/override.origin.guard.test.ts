import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { guardOverrideRequest } from "@/lib/ff/override-guard";
import { __resetRateLimit } from "@/lib/ff/ratelimit";

describe("Origin/Referer guard (production)", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    __resetRateLimit();
    process.env = { ...savedEnv, NODE_ENV: "production", FF_TESTER_TOKEN: "secret" };
  });

  afterEach(() => {
    __resetRateLimit();
    process.env = { ...savedEnv };
  });

  function mk(url: string, headers: Record<string, string>) {
    return new Request(url, { headers });
  }

  it("allows same-origin requests", () => {
    const req = mk("https://example.com/api/ff-override?ff=a:true", {
      origin: "https://example.com",
      referer: "https://example.com/page",
      "x-forwarded-for": "1.1.1.1",
      "x-ff-tester": "secret",
    });
    const gate = guardOverrideRequest(req);
    expect(gate.allow).toBe(true);
  });

  it("blocks cross-site requests with foreign origin", () => {
    const req = mk("https://example.com/api/ff-override?ff=a:true", {
      origin: "https://evil.com",
      referer: "https://evil.com/hack",
      "x-forwarded-for": "2.2.2.2",
      "x-ff-tester": "secret",
    });
    const gate = guardOverrideRequest(req);
    expect(gate.allow).toBe(false);
    if (!gate.allow) expect(gate.code).toBe(403);
  });
});
