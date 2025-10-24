import { cookies } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getStableIdFromCookies, stableId } from "@/lib/ff/stable-id";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);

describe("stableId cookies", () => {
  afterEach(() => {
    mockedCookies.mockReset();
  });

  it("uses sv_id cookie when present", () => {
    mockedCookies.mockReturnValue({
      get: (name: string) => (name === "sv_id" ? { name, value: "sv-uuid-1" } : undefined),
      getAll: () => [{ name: "sv_id", value: "sv-uuid-1" }],
    } as ReturnType<typeof cookies>);
    expect(getStableIdFromCookies()).toBe("sv-uuid-1");
    expect(stableId()).toBe("sv-uuid-1");
  });
});
