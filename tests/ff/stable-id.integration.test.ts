import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type CookieValue = { value: string };
type CookieRecord = { name: string; value: string };
type CookieStore = {
  get: (name: string) => CookieValue | undefined;
  getAll: () => CookieRecord[];
};

const cookiesMock = vi.hoisted(() => vi.fn<() => CookieStore>());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: vi.fn(() => ({ get: () => null })),
}));

import { getFlagsServer } from "../../lib/ff/effective.server";
import { inRollout } from "../../lib/ff/hash";

describe("S3-B StableId integration", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFF = process.env.FEATURE_FLAGS_JSON;

  const mockCookies = (aid?: string) => {
    const get = vi.fn<(name: string) => CookieValue | undefined>((name) =>
      name === "ff_aid" && aid ? { value: aid } : undefined,
    );
    const getAll = vi.fn<() => CookieRecord[]>(() => (aid ? [{ name: "ff_aid", value: aid }] : []));
    cookiesMock.mockReturnValue({ get, getAll });
  };

  beforeEach(() => {
    cookiesMock.mockReset();
    process.env.NODE_ENV = "test";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 50 },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = savedNodeEnv;
    if (savedFF === undefined) {
      delete process.env.FEATURE_FLAGS_JSON;
    } else {
      process.env.FEATURE_FLAGS_JSON = savedFF;
    }
  });

  it("keeps rollout bucket stable across login/logout for the same ff_aid", async () => {
    const cookieValue = "aid_login";
    const expected = inRollout(cookieValue, 50, "newCheckout");
    mockCookies(cookieValue);
    const beforeLogin = await getFlagsServer();
    mockCookies(cookieValue);
    const afterLogin = await getFlagsServer({ userId: "123" });
    expect(beforeLogin.newCheckout).toBe(expected);
    expect(afterLogin.newCheckout).toBe(expected);
  });

  it("ignores userId changes when ff_aid stays the same", async () => {
    const cookieValue = "aid_user_change";
    mockCookies(cookieValue);
    const first = await getFlagsServer({ userId: "123" });
    mockCookies(cookieValue);
    const second = await getFlagsServer({ userId: "456" });
    expect(first.newCheckout).toBe(second.newCheckout);
  });

  it("changes rollout bucket when ff_aid changes", async () => {
    let inId = "";
    let outId = "";
    for (let i = 0; i < 5000 && (!inId || !outId); i++) {
      const candidate = `aid_${i}`;
      if (inRollout(candidate, 50, "newCheckout")) {
        if (!inId) inId = candidate;
      } else if (!outId) {
        outId = candidate;
      }
    }
    expect(inId && outId).toBeTruthy();
    mockCookies(inId);
    const inRolloutResult = await getFlagsServer();
    mockCookies(outId);
    const outRolloutResult = await getFlagsServer();
    expect(inRolloutResult.newCheckout).toBe(true);
    expect(outRolloutResult.newCheckout).toBe(false);
  });
});
