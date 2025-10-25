import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { GET } from "../../app/api/ff-override/route";

const cookiesMock = vi.hoisted(() =>
  vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: vi.fn(() => ({ get: () => null })),
}));

describe("S3-D: override type validation", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    cookiesMock.mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }));
    Object.assign(process.env, saved);
    process.env.NODE_ENV = "test";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      betaUI: false,
      bannerText: "",
      maxItems: 10,
      newCheckout: { enabled: true, percent: 0 },
    });
  });

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(env)) {
      if (!(key in saved)) {
        delete env[key];
      }
    }
    Object.assign(process.env, saved);
    cookiesMock.mockReset();
  });

  it("boolean flag must receive boolean override", async () => {
    const req = new Request("http://localhost/api/ff-override?ff=betaUI:1");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details?.join(" ")).toMatch(/betaUI must be boolean/);
  });

  it("string flag must receive string override", async () => {
    const req = new Request("http://localhost/api/ff-override?ff=bannerText:123");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details?.join(" ")).toMatch(/bannerText must be string/);
  });

  it("number flag must receive number override", async () => {
    const req = new Request('http://localhost/api/ff-override?ff=maxItems:"abc"');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details?.join(" ")).toMatch(/maxItems must be number/);
  });

  it("rollout flag override must be boolean (force ON/OFF)", async () => {
    const req = new Request("http://localhost/api/ff-override?ff=newCheckout:25");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details?.join(" ")).toMatch(/newCheckout rollout override must be boolean/);
  });
});
