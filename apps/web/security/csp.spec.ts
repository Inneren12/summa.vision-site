import { describe, expect, it } from "vitest";

import { buildCSP } from "./csp.mjs";

describe("CSP builder", () => {
  it("includes safe defaults", () => {
    const csp = buildCSP();

    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it("adds sentry connect when enabled", () => {
    const csp = buildCSP({ withSentry: true });

    expect(csp).toMatch(/connect-src .*sentry\.io/);
  });

  it("disables 'unsafe-eval' in production", () => {
    const dev = buildCSP({ isDev: true });
    const prod = buildCSP({ isDev: false });

    expect(dev).toMatch(/script-src .*'unsafe-eval'/);
    expect(prod).not.toMatch(/'unsafe-eval'/);
  });
});
