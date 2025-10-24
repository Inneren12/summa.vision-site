import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { POST } from "@/app/api/admin/ff-emergency-disable/route";

type AdminPayload = {
  flag: string;
  value: unknown;
  ttlSeconds?: number;
  reason?: string;
};

function req(body: AdminPayload, hdrs: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/ff-emergency-disable", {
    method: "POST",
    headers: { "content-type": "application/json", ...hdrs },
    body: JSON.stringify(body),
  });
}

describe("Variant admin override", () => {
  const savedFeatureFlags = process.env.FEATURE_FLAGS_JSON;
  const savedAdminToken = process.env.FF_ADMIN_TOKEN;
  const savedNodeEnv = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.FF_ADMIN_TOKEN = "adm1n";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      uiExperiment: { enabled: true, variants: { control: 50, treatment: 50 } },
    });
  });
  afterEach(() => {
    if (typeof savedNodeEnv === "undefined") {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    if (typeof savedAdminToken === "undefined") {
      delete process.env.FF_ADMIN_TOKEN;
    } else {
      process.env.FF_ADMIN_TOKEN = savedAdminToken;
    }
    if (typeof savedFeatureFlags === "undefined") {
      delete process.env.FEATURE_FLAGS_JSON;
    } else {
      process.env.FEATURE_FLAGS_JSON = savedFeatureFlags;
    }
  });

  it("accepts valid variant name", async () => {
    const r = await POST(
      req(
        { flag: "uiExperiment", value: "treatment", ttlSeconds: 60 },
        { "x-ff-admin-token": "adm1n" },
      ),
    );
    expect(r.status).toBe(200);
  });

  it("rejects unknown variant", async () => {
    const r = await POST(
      req({ flag: "uiExperiment", value: "blue", ttlSeconds: 60 }, { "x-ff-admin-token": "adm1n" }),
    );
    expect(r.status).toBe(400);
    const b = await r.json();
    expect(String(b.details || "")).toMatch(/unknown variant/i);
  });
});
