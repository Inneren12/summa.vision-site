import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { POST } from "@/app/api/dev/overrides/clear/route";
import { __resetEnvCache } from "@/lib/env/load";

describe("Dev API /api/dev/overrides/clear", () => {
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
    __resetEnvCache();
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("clears overrides cookie", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const set = res.headers.get("set-cookie");
    expect(set?.includes("sv_flags_override=")).toBe(true);
  });
});
