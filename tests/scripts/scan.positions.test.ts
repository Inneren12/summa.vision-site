import { describe, it, expect } from "vitest";

import { scanTextForFlags } from "../../scripts/doctor/scan.js";

describe("scanTextForFlags positions", () => {
  it("returns line/col for unknown usage", () => {
    const flags = ["betaUI"];
    const sample = `
      // comment line
      const on = useFlag('betaUI');
      const link = "/api/ff-override?ff=unknownFlag:true";
    `;
    const result = scanTextForFlags(sample, flags);
    expect(Array.from(result.unknown.keys())).toContain("unknownFlag");
    const hit = result.occurrences.find((o) => o.name === "unknownFlag");
    expect(hit?.line).toBeGreaterThan(0);
    expect(hit?.col).toBeGreaterThan(0);
    expect(hit?.fuzzy).toBe(true);
  });
});
