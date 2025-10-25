import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { guardOverrideRequest } from "../../lib/ff/override-guard";
import { __resetRateLimit } from "../../lib/ff/ratelimit";

function mkReq(headers: Record<string, string>) {
  return new Request("http://localhost/api/ff-override?ff=a:true", { headers });
}

describe("override guard: rl key ip+stableId and safe rpm parsing", () => {
  const saved = { ...process.env };
  beforeEach(async () => {
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "development";
    process.env.FF_OVERRIDE_RPM = "1";
    await __resetRateLimit();
  });
  afterEach(async () => {
    const env = process.env as Record<string, string | undefined>;
    Object.keys(env).forEach((key) => {
      delete env[key];
    });
    Object.assign(process.env, saved);
    await __resetRateLimit();
  });

  it("separates buckets by ff_aid for same IP", async () => {
    const ip = "9.9.9.9";
    const r1 = mkReq({ "x-forwarded-for": ip, cookie: "ff_aid=A" });
    const r2 = mkReq({ "x-forwarded-for": ip, cookie: "ff_aid=B" });
    expect((await guardOverrideRequest(r1)).allow).toBe(true);
    expect((await guardOverrideRequest(r2)).allow).toBe(true);
    const r1Again = mkReq({ "x-forwarded-for": ip, cookie: "ff_aid=A" });
    const d = await guardOverrideRequest(r1Again);
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.code).toBe(429);
  });

  it("uses default rpm when env is invalid", async () => {
    process.env.FF_OVERRIDE_RPM = "NaN";
    const ip = "1.2.3.4";
    const a = await guardOverrideRequest(mkReq({ "x-forwarded-for": ip }));
    const b = await guardOverrideRequest(mkReq({ "x-forwarded-for": ip }));
    expect(a.allow && b.allow).toBe(true);
  });
});
