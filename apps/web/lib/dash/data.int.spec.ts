import { describe, it, expect } from "vitest";

import { datasetUrl } from "./data";
import type { Filters } from "./url";

describe("SWR datasetUrl", () => {
  it("builds /api/stories with filters", () => {
    const filters: Filters = { country: "CA" };
    const url = datasetUrl("demo", filters);
    expect(url).toContain("/api/stories");
    expect(url).toContain("country=CA");
  });
});
