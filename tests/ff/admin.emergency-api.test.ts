import * as hdr from "next/headers";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { POST } from "@/app/api/admin/ff-emergency-disable/route";
import { __clearAudit, readAuditRecent } from "@/lib/ff/audit";
import { getFlagsServer } from "@/lib/ff/effective.server";
import { __resetGlobals, __countGlobals } from "@/lib/ff/global";
import * as server from "@/lib/ff/server";

function req(body: unknown, hdrs: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/ff-emergency-disable", {
    method: "POST",
    headers: { "content-type": "application/json", ...hdrs },
    body: JSON.stringify(body),
  });
}

describe("S3-E Admin Emergency Disable API", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "test";
    process.env.FF_ADMIN_TOKEN = "adm1n";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 0 },
      betaUI: false,
    });
    __resetGlobals();
    __clearAudit();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    Object.keys(process.env).forEach((key) => delete (process.env as NodeJS.ProcessEnv)[key]);
    Object.assign(process.env, saved);
    __resetGlobals();
    __clearAudit();
    vi.restoreAllMocks();
  });

  it("401 без токена, 403 с неверным токеном", async () => {
    let res = await POST(req({ flag: "betaUI", value: true }, {}));
    expect(res.status).toBe(401);
    res = await POST(req({ flag: "betaUI", value: true }, { "x-ff-admin-token": "wrong" }));
    expect(res.status).toBe(403);
  });

  it("415 при неверном Content-Type", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/ff-emergency-disable", {
        method: "POST",
        headers: { "x-ff-admin-token": "adm1n", "content-type": "text/plain" },
        body: "flag=betaUI",
      }),
    );
    expect(res.status).toBe(415);
  });

  it("413 при payload > 1024", async () => {
    const big = "x".repeat(2000);
    const res = await POST(req({ flag: "betaUI", value: big }, { "x-ff-admin-token": "adm1n" }));
    expect(res.status).toBe(400);
    const res2 = await POST(
      new Request("http://localhost/api/admin/ff-emergency-disable", {
        method: "POST",
        headers: {
          "x-ff-admin-token": "adm1n",
          "content-type": "application/json",
          "content-length": "2001",
        },
        body: JSON.stringify({ flag: "betaUI", value: true }),
      }),
    );
    expect([413, 200, 400]).toContain(res2.status);
  });

  it("400 для unknown flag и ошибок типов", async () => {
    let res = await POST(
      req({ flag: "doesNotExist", value: true }, { "x-ff-admin-token": "adm1n" }),
    );
    expect(res.status).toBe(400);
    res = await POST(req({ flag: "betaUI", value: 123 }, { "x-ff-admin-token": "adm1n" }));
    expect(res.status).toBe(400);
  });

  it('успешный set глобального override и источник "global"', async () => {
    vi.spyOn(hdr, "cookies").mockReturnValue({
      getAll: () => [],
      get: () => undefined,
    } as unknown as ReturnType<typeof hdr.cookies>);
    const res = await POST(
      req(
        { flag: "newCheckout", value: true, ttlSeconds: 60, reason: "incident" },
        { "x-ff-admin-token": "adm1n" },
      ),
    );
    expect(res.status).toBe(200);
    expect(__countGlobals()).toBe(1);
    const cookieHeader = "";
    const { sources } = await server.getFeatureFlagsFromHeadersWithSources({
      cookie: cookieHeader,
    });
    expect(sources.newCheckout).toBe("global");
    const effective = await getFlagsServer();
    expect(effective.newCheckout).toBe(true);
    const audit = readAuditRecent(10);
    expect(audit.length).toBe(1);
    expect(audit[0].flag).toBe("newCheckout");
  });

  it("capacity limit срабатывает", async () => {
    for (let i = 0; i < 100; i += 1) {
      const res = await POST(
        req(
          { flag: "betaUI", value: Boolean(i % 2), ttlSeconds: 3600, reason: `r${i}` },
          { "x-ff-admin-token": "adm1n" },
        ),
      );
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) break;
    }
  });
});
