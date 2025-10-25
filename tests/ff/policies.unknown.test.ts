import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

import { GET } from "../../app/api/ff-override/route";

describe("S3-D: unknown flags policy", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    cookiesMock.mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }));
    Object.assign(process.env, saved);
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: false });
    process.env.FF_TESTER_TOKEN = "token123";
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

  function mkRequest(url: string) {
    const headers: Record<string, string> = {};
    if (process.env.FF_TESTER_TOKEN) {
      headers["x-ff-tester"] = process.env.FF_TESTER_TOKEN;
    }
    return new Request(url, { headers });
  }

  it("production defaults to STRICT 400 for unknown flags", async () => {
    process.env.NODE_ENV = "production";
    const req = mkRequest("http://localhost/api/ff-override?ff=doesNotExist:true");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown flags/);
    expect(Array.isArray(body.unknown)).toBe(true);
  });

  it("development can allow unknown unless FF_ENFORCE_KNOWN_FLAGS=true", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.FF_ENFORCE_KNOWN_FLAGS;
    const req = mkRequest("http://localhost/api/ff-override?ff=customDevFlag:true");
    const res = await GET(req);
    if (![200, 302].includes(res.status)) {
      const body = await res.json();
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  it("development + FF_ENFORCE_KNOWN_FLAGS=true → 400", async () => {
    process.env.NODE_ENV = "development";
    process.env.FF_ENFORCE_KNOWN_FLAGS = "true";
    const req = mkRequest("http://localhost/api/ff-override?ff=unknownX:true");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
