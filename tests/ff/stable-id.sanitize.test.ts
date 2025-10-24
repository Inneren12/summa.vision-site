import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sanitizeUserId, stableId, STABLEID_USER_PREFIX } from "@/lib/ff/stable-id";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);

describe("stableId sanitize", () => {
  beforeEach(() => {
    mockedCookies.mockReturnValue({
      get: () => undefined,
      getAll: () => [],
    } as unknown as ReturnType<typeof cookies>);
  });

  afterEach(() => {
    mockedCookies.mockReset();
  });

  it("accepts safe userId and prefixes with u:", () => {
    const uid = "john_doe-123";
    expect(sanitizeUserId(uid)).toBe(uid);
    const id = stableId(uid);
    expect(id).toBe(`${STABLEID_USER_PREFIX}${uid}`);
  });

  it("rejects invalid userId in non-strict mode (fallback, no throw)", () => {
    const bad = "john doe !";
    expect(sanitizeUserId(bad)).toBeUndefined();
    expect(() => stableId(bad)).not.toThrow();
    expect(stableId(bad)).toBe("anon"); // без cookie — мягкий fallback
  });

  it("throws in strict mode for invalid userId", () => {
    const bad = "   ";
    expect(() => stableId(bad, { strict: true })).toThrow();
  });
});
