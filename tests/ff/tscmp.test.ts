import { describe, it, expect } from "vitest";

import { tscmp } from "@/lib/ff/tscmp";

describe("tscmp", () => {
  it("equals when strings match", () => {
    expect(tscmp("abc", "abc")).toBe(true);
  });
  it("not equals on different strings", () => {
    expect(tscmp("abc", "abd")).toBe(false);
  });
  it("handles null/undefined safely", () => {
    expect(tscmp(undefined, undefined)).toBe(true);
    expect(tscmp(null, "")).toBe(true);
    expect(tscmp(undefined, "a")).toBe(false);
  });
});
