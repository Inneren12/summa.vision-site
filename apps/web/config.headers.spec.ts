import { describe, expect, it } from "vitest";

import cfg from "./next.config.mjs";

describe("next config headers()", () => {
  it("returns route-level headers array", async () => {
    const rules = await cfg.headers();

    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);

    const anyHeaders = rules[0]?.headers ?? [];
    const hasXCTO = anyHeaders.some(
      (header: { key: string }) => header.key === "X-Content-Type-Options",
    );

    expect(hasXCTO).toBe(true);
  });
});
