import { describe, it, expect } from "vitest";

describe("local eslint rule presence", () => {
  it("rule module can be required", async () => {
    const rule = await import("../../scripts/eslint/rules/no-ff-server-in-client.js");
    expect(rule).toBeTruthy();
    expect(typeof rule.default === "object" || typeof rule === "object").toBe(true);
  });
});
