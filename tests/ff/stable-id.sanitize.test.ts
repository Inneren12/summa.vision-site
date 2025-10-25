import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sanitizeUserId, stableId } from "@/lib/ff/stable-id";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => ({ get: () => null })),
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

  it("accepts safe userId and keeps stableId cookie value", () => {
    const uid = "john_doe-123";
    expect(sanitizeUserId(uid)).toBe(uid);
    mockedCookies.mockReturnValueOnce({
      get: (name: string) => (name === "ff_aid" ? { value: "aid-cookie" } : undefined),
      getAll: () => [{ name: "ff_aid", value: "aid-cookie" }],
    } as unknown as ReturnType<typeof cookies>);
    const id = stableId(uid);
    expect(id).toBe("aid-cookie");
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
