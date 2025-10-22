import { describe, it, expect } from "vitest";

import cfg from "./next.config.mjs";

describe("next config", () => {
  it("has strict mode", () => {
    expect(cfg.reactStrictMode).toBe(true);
  });

  it("typedRoutes is enabled when present", () => {
    const tr = cfg?.experimental?.typedRoutes;
    // допускаем отсутствие поля в новых версиях Next
    expect(tr === undefined || tr === true).toBe(true);
  });

  it("images.remotePatterns defined", () => {
    const arr = cfg?.images?.remotePatterns;
    if (!Array.isArray(arr)) {
      throw new Error("remotePatterns should be an array");
    }
    expect(arr.length).toBeGreaterThan(0);
  });
});
