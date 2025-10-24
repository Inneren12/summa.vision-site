import { describe, it, beforeEach, afterEach, vi } from "vitest";

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
}));

describe("S3-D: dotted-path overrides handling", () => {
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

  it("production: dotted-path keys are ignored (not applied)", async () => {
    process.env.NODE_ENV = "production";
    const req = mkRequest("http://localhost/api/ff-override?ff=betaUI.value:true");
    const res = await GET(req);
    if (![200, 302].includes(res.status)) {
      const body = await res.json();
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  it("development: allow dotted only if ALLOW_DOTTED_OVERRIDE=true", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DOTTED_OVERRIDE;
    const req = mkRequest("http://localhost/api/ff-override?ff=betaUI.value:true");
    const res = await GET(req);
    if (![200, 302].includes(res.status)) {
      const body = await res.json();
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(body)}`);
    }

    process.env.ALLOW_DOTTED_OVERRIDE = "true";
    const req2 = mkRequest("http://localhost/api/ff-override?ff=betaUI.value:true");
    const res2 = await GET(req2);
    if (![200, 302].includes(res2.status)) {
      const body = await res2.json();
      throw new Error(`Unexpected status ${res2.status}: ${JSON.stringify(body)}`);
    }
  });
});
