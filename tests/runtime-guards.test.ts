import { describe, it, expect } from "vitest";

import { assertServer, assertClient, isServer, isClient } from "../lib/runtime-guards";

describe("runtime guards", () => {
  it("detects server", () => {
    type GlobalWithWindow = typeof globalThis & { window?: unknown };
    const globalRef = globalThis as GlobalWithWindow;
    const hadWindow = "window" in globalRef;
    const savedWindow = globalRef.window;
    try {
      // ensure no window
      delete globalRef.window;
      expect(isServer()).toBe(true);
      expect(() => assertServer()).not.toThrow();
      expect(() => assertClient()).toThrow();
    } finally {
      if (hadWindow) globalRef.window = savedWindow;
    }
  });

  it("detects client (simulated)", () => {
    type GlobalWithWindow = typeof globalThis & { window?: unknown };
    const globalRef = globalThis as GlobalWithWindow;
    const hadWindow = "window" in globalRef;
    const savedWindow = globalRef.window;
    try {
      globalRef.window = {};
      expect(isClient()).toBe(true);
      expect(() => assertClient()).not.toThrow();
      expect(() => assertServer()).toThrow();
    } finally {
      if (hadWindow) globalRef.window = savedWindow;
      else delete globalRef.window;
    }
  });
});
