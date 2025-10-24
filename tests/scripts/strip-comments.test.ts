import { describe, it, expect } from "vitest";

import { stripComments } from "../../scripts/utils/strip-comments";

describe("stripComments", () => {
  it("removes line and block comments, keeps strings", () => {
    const src = `
      // top line
      const a = "http://x//y"; // url with slashes
      const b = 'text /* not comment */';
      /* block
         comment */
      const c = \`hello // not comment in template\`;
    `;
    const out = stripComments(src);
    expect(out).not.toMatch(/top line/);
    expect(out).not.toMatch(/block\s+comment/);
    expect(out).toMatch(/http:\/\/x\/\/y/);
    expect(out).toMatch(/text \/\* not comment \*\//);
    expect(out).toMatch(/hello \/\/ not comment/);
  });

  it("handles ${} in templates and strips comments inside expressions", () => {
    const src = `
      const v = \`value: \${ 1 + 2 // inner comment
      }\`;
    `;
    const out = stripComments(src);
    expect(out).not.toMatch(/inner comment/);
    expect(out).toMatch(/value:/);
  });
});
