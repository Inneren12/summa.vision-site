import { cookies } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getStableIdFromCookies, stableId } from "@/lib/ff/stable-id";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => ({ get: () => null })),
}));

const mockedCookies = vi.mocked(cookies);

describe("stableId cookies", () => {
  afterEach(() => {
    mockedCookies.mockReset();
  });

  it("uses ff_aid cookie when present", () => {
    mockedCookies.mockReturnValue({
      get: (name: string) => (name === "ff_aid" ? { name, value: "aid-uuid-1" } : undefined),
      getAll: () => [{ name: "ff_aid", value: "aid-uuid-1" }],
    } as ReturnType<typeof cookies>);
    expect(getStableIdFromCookies()).toBe("aid-uuid-1");
    expect(stableId()).toBe("aid-uuid-1");
  });
});
