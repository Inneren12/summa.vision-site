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
}));

import { getFlagsServer } from "../../lib/ff/effective.server";
import { inRollout } from "../../lib/ff/hash";

describe("S3-B StableId integration", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFF = process.env.FEATURE_FLAGS_JSON;

  const mockCookies = (sv?: string) => {
    const get = vi.fn<(name: string) => CookieValue | undefined>((name) =>
      name === "sv_id" && sv ? { value: sv } : undefined,
    );
    const getAll = vi.fn<() => CookieRecord[]>(() => (sv ? [{ name: "sv_id", value: sv }] : []));
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

  it("uses userId across devices (sv_id changes do not change outcome for same userId)", async () => {
    // Предсказуемый результат для u:123
    const expected = inRollout("u:123", 50, "newCheckout");
    // sv_id #1
    mockCookies("sv_aaa");
    const f1 = await getFlagsServer({ userId: "123" });
    expect(f1.newCheckout).toBe(expected);
    // sv_id #2
    mockCookies("sv_bbb");
    const f2 = await getFlagsServer({ userId: "123" });
    expect(f2.newCheckout).toBe(expected);
  });

  it("without userId result depends on sv_id", async () => {
    // Подберём парочку sv_id с разными исходами
    let inId = "";
    let outId = "";
    for (let i = 0; i < 5000 && (!inId || !outId); i++) {
      const c = `sv_${i}`;
      if (inRollout(c, 50, "newCheckout")) {
        if (!inId) inId = c;
      } else {
        if (!outId) outId = c;
      }
    }
    expect(inId && outId).toBeTruthy();
    mockCookies(inId);
    const a = await getFlagsServer();
    expect(a.newCheckout).toBe(true);
    mockCookies(outId);
    const b = await getFlagsServer();
    expect(b.newCheckout).toBe(false);
  });
});
