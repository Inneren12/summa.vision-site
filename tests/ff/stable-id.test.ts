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
});
