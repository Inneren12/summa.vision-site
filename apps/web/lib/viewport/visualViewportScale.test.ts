import { describe, expect, it } from "vitest";

import { scaleRootMargin } from "./visualViewportScale";

describe("scaleRootMargin", () => {
  it("scales percentage values inversely to the viewport scale", () => {
    const result = scaleRootMargin("-35% 0px -35% 0px", 2);
    expect(result).toBe("-17.5% 0px -17.5% 0px");
  });

  it("scales pixel values inversely to the viewport scale", () => {
    const result = scaleRootMargin("-200px 0px", 1.25);
    expect(result).toBe("-160px 0px");
  });

  it("returns the original string when scaling is not applicable", () => {
    const original = "-45% 0px -45% 0px";
    expect(scaleRootMargin(original, 1)).toBe(original);
    expect(scaleRootMargin(original, 0)).toBe(original);
    expect(scaleRootMargin(original, Number.NaN)).toBe(original);
  });
});
