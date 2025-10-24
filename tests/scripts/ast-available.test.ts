import { describe, it, expect } from "vitest";

import { astAvailable } from "../../scripts/doctor/ast.js";

describe("doctor AST availability", () => {
  it("returns boolean and never throws", async () => {
    const ok = await astAvailable();
    expect(typeof ok).toBe("boolean");
  });
});
