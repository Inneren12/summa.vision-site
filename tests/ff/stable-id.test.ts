import { cookies } from "next/headers";
import { describe, it, expect, vi, afterEach } from "vitest";

import * as stable from "../../lib/ff/stable-id";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => ({ get: () => null })),
}));

describe("stableId()", () => {
  afterEach(() => {
    vi.mocked(cookies).mockReset();
  });

  it("prefers ff_aid cookie when present", () => {
    type CookiesReturn = ReturnType<typeof cookies>;
    const withValue = {
      get: vi
        .fn()
        .mockImplementation((name: string) =>
          name === "ff_aid" ? { value: "aid-123" } : undefined,
        ),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withValue);
    expect(stable.stableId("user-1")).toBe("aid-123");

    const withoutValue = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withoutValue);
    expect(stable.stableId()).toBe("anon");
  });

  it("ignores legacy sv_id cookie when ff_aid is absent", () => {
    type CookiesReturn = ReturnType<typeof cookies>;
    const legacyOnly = {
      get: vi
        .fn()
        .mockImplementation((name: string) =>
          name === "sv_id" ? { value: "sv-only" } : undefined,
        ),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(legacyOnly);
    expect(stable.stableId()).toBe("anon");
    expect(stable.getStableIdFromCookieHeader("sv_id=sv-only")).toBeUndefined();
  });
});
