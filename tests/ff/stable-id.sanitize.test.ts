import { afterEach, describe, it, expect, vi } from "vitest";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

const cookiesMock = vi.hoisted(() => vi.fn<() => CookieStore>());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { stableId, STABLEID_USER_PREFIX } from "../../lib/ff/stable-id";

describe("stableId sanitization and fallback", () => {
  afterEach(() => {
    cookiesMock.mockReset();
  });
  it("rejects invalid userId", () => {
    expect(() => stableId("bad!id")).toThrowError(/Invalid userId/);
  });
  it("prefixes valid userId with STABLEID_USER_PREFIX", () => {
    expect(stableId("abc_123")).toBe(`${STABLEID_USER_PREFIX}abc_123`);
  });
  it("generates fallback when no cookie and no userId", () => {
    cookiesMock.mockReturnValue({ get: () => undefined });
    const id = stableId();
    expect(id.startsWith("g:")).toBe(true);
  });
});
