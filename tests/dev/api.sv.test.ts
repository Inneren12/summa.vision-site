import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { GET } from "@/app/api/dev/sv/route";
import { __resetEnvCache } from "@/lib/env/load";

describe("Dev API /api/dev/sv", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";
    __resetEnvCache();
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, saved);
    __resetEnvCache();
  });

  it("returns 404 when dev tools disabled", async () => {
    delete process.env.NEXT_PUBLIC_DEV_TOOLS;
    const res = await GET(new Request("http://localhost/api/dev/sv"));
    expect(res.status).toBe(404);
  });

  it("sets random sv_id", async () => {
    const res = await GET(new Request("http://localhost/api/dev/sv?id=random"));
    expect([200]).toContain(res.status);
    const set = res.headers.get("set-cookie");
    expect(set?.includes("sv_id=")).toBe(true);
  });

  it("clears sv_id", async () => {
    const res = await GET(new Request("http://localhost/api/dev/sv?id=clear"));
    expect(res.status).toBe(200);
    const set = res.headers.get("set-cookie");
    expect(set?.includes("sv_id=")).toBe(true);
  });
});
