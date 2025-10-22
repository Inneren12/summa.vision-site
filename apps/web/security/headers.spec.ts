import { describe, expect, it } from "vitest";

import { securityHeaders } from "./headers.mjs";

describe("security headers", () => {
  it("contain required keys", () => {
    const hs = securityHeaders();
    const keys = Object.fromEntries(hs.map((h) => [h.key.toLowerCase(), true]));

    for (const headerKey of [
      "x-content-type-options",
      "referrer-policy",
      "x-frame-options",
      "cross-origin-opener-policy",
      "permissions-policy",
    ]) {
      expect(keys[headerKey]).toBe(true);
    }

    expect(keys["content-security-policy"] || keys["content-security-policy-report-only"]).toBe(
      true,
    );
  });
});
