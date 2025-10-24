import { describe, it, expect } from "vitest";

import { stripComments } from "../../scripts/utils/strip-comments.js";

describe("stripComments", () => {
  it("removes line and block comments, keeps strings and templates", () => {
    const src = `
      // top line
      const a = "http://x//y"; // url with slashes
      const b = 'text /* not comment */';
      /* block
         comment */
      const c = \`hello // not comment in template\`;
      const d = \`tmpl \${ 1 /* inner */ + 2 // line
      }\`;
    `;
    const out = stripComments(src);
    expect(out).not.toMatch(/top line/);
    expect(out).not.toMatch(/block\s+comment/);
    expect(out).toMatch(/http:\/\/x\/\/y/);
    expect(out).toMatch(/text \/\* not comment \*\//);
    expect(out).toMatch(/hello \/\/ not comment/);
    expect(out).not.toMatch(/inner/);
  });
});
