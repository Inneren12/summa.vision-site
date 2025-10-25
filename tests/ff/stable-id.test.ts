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

  it("uses userId when provided", () => {
    expect(stable.stableId("123")).toBe("u:123");
  });

  it("falls back to cookie sv_id or anon", () => {
    type CookiesReturn = ReturnType<typeof cookies>;
    const withValue = {
      get: vi.fn().mockReturnValue({ value: "abc" }),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withValue);
    expect(stable.stableId()).toBe("abc");

    const withoutValue = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withoutValue);
    expect(stable.stableId()).toBe("anon");
  });
});
