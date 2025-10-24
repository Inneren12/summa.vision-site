import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { GET } from "@/app/api/dev/ff-schema/route";

describe("Dev API /api/dev/ff-schema", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";
  });
  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(env)) {
      delete env[key];
    }
    Object.assign(process.env, saved);
  });

  it("returns report", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: false });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("errors");
    expect(body).toHaveProperty("warnings");
  });

  it("404 when dev tools disabled", async () => {
    delete process.env.NEXT_PUBLIC_DEV_TOOLS;
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
