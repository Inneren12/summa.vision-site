import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("tokens css copied", () => {
  it("contains primary token", () => {
    const filePath = path.join(__dirname, "tokens.css");
    const css = fs.readFileSync(filePath, "utf8");
    expect(css).toMatch(/--color-fg-default:/);
  });
});
