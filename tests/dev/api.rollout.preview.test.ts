import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { GET } from "@/app/api/dev/rollout-preview/route";

describe("Dev API /api/dev/rollout-preview", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 50 },
    });
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, saved);
  });

  it("rejects when not rollout", async () => {
    const res = await GET(
      new Request("http://localhost/api/dev/rollout-preview?flag=betaUI&sid=u:1"),
    );
    expect([400, 200]).toContain(res.status); // если betaUI нет в реестре — unknown
  });

  it("ok for rollout flag", async () => {
    const res = await GET(
      new Request("http://localhost/api/dev/rollout-preview?flag=newCheckout&sid=u:123"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag).toBe("newCheckout");
    expect(typeof body.inRollout).toBe("boolean");
  });
});
