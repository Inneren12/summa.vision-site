import { cookies } from "next/headers";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => ({ get: () => null })),
}));

import { GET } from "@/app/api/ff-override/route";

describe("Variant override API", () => {
  const savedFeatureFlags = process.env.FEATURE_FLAGS_JSON;
  beforeEach(() => {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    } as unknown as ReturnType<typeof cookies>);
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      uiExperiment: { enabled: true, variants: { control: 50, treatment: 50 } },
    });
  });
  afterEach(() => {
    vi.mocked(cookies).mockReset();
    if (typeof savedFeatureFlags === "undefined") {
      delete process.env.FEATURE_FLAGS_JSON;
    } else {
      process.env.FEATURE_FLAGS_JSON = savedFeatureFlags;
    }
  });

  it("accepts known variant string", async () => {
    const res = await GET(
      new Request('http://localhost/api/ff-override?ff=uiExperiment:"treatment"'),
    );
    expect([200, 302]).toContain(res.status);
  });

  it("rejects unknown variant string", async () => {
    const res = await GET(new Request('http://localhost/api/ff-override?ff=uiExperiment:"blue"'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect((body.details || []).join(" ")).toMatch(/unknown variant/i);
  });
});
