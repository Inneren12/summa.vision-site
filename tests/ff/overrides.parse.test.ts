import { describe, it, expect } from "vitest";

import {
  parseFFQuery,
  applyOverrideDiff,
  validateOverridesCandidate,
  encodeOverridesCookie,
  readOverridesFromCookieHeader,
  type Overrides,
} from "../../lib/ff/overrides";

describe("overrides parsing and validation", () => {
  it("parses booleans, numbers, strings, quoted strings", () => {
    const diff = parseFFQuery('a:true,b:0,c:10.5,d:"str",e:off');
    expect(diff).toEqual({ a: true, b: 0, c: 10.5, d: "str", e: false });
  });

  it("null removes key; undefined is invalid", () => {
    const diff = parseFFQuery("x:null", { allowDottedPaths: true });
    const merged = applyOverrideDiff({ x: true, y: 1 }, diff);
    expect(merged).toEqual({ y: 1 });
    expect(() => parseFFQuery("x:undefined")).toThrow();
  });

  it("ignores dotted paths when not allowed", () => {
    const diff = parseFFQuery("flag.percent:25,foo:true", { allowDottedPaths: false });
    expect(diff).toEqual({ foo: true });
  });

  it("validates size and value limits", () => {
    validateOverridesCandidate({ ok: true, n: 10, s: "x" });
    expect(() => validateOverridesCandidate({ bad: 1e9 })).toThrow();
    const big = "x".repeat(300);
    expect(() => validateOverridesCandidate({ s: big })).toThrow();
    const many: Record<string, boolean> = {};
    for (let i = 0; i < 60; i += 1) many[`k${i}`] = true;
    expect(() => validateOverridesCandidate(many)).toThrow();
    const hugeEntries = Array.from({ length: 200 }, (_, i) => [`k${i}`, "x".repeat(20)] as const);
    const huge = Object.fromEntries(hugeEntries) as Record<string, string>;
    const hugeOverrides: Overrides = huge;
    expect(() => encodeOverridesCookie(hugeOverrides)).toThrow();
  });

  it("reads overrides from Cookie header", () => {
    const cookie = "sv_flags_override=" + encodeURIComponent(JSON.stringify({ a: true, n: 3 }));
    const o = readOverridesFromCookieHeader(cookie);
    expect(o).toEqual({ a: true, n: 3 });
  });
});
