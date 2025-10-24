import { cookies } from "next/headers";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { stableId } from "../../lib/ff/stable-id";

describe("stableId()", () => {
  afterEach(() => {
    vi.mocked(cookies).mockReset();
  });

  it("uses userId when provided", () => {
    expect(stableId("123")).toBe("user_123");
  });

  it("falls back to cookie sv_id or anon", () => {
    type CookiesReturn = ReturnType<typeof cookies>;
    const withValue = {
      get: vi.fn().mockReturnValue({ value: "abc" }),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withValue);
    expect(stableId()).toBe("abc");

    const withoutValue = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as CookiesReturn;
    vi.mocked(cookies).mockReturnValueOnce(withoutValue);
    expect(stableId()).toBe("anon");
  });
});
