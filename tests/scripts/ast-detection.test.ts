import { describe, expect, it } from "vitest";

import { astAvailable, scanTextForFlagsAST } from "../../scripts/doctor/ast.js";

const FLAGS = ["alphaFlag", "betaFlag"];

async function requireAst() {
  const available = await astAvailable();
  expect(available).toBe(true);
}

describe("doctor AST detection", () => {
  it("detects useFlag in TypeScript", async () => {
    await requireAst();
    const result = await scanTextForFlagsAST(
      "export const feature = () => useFlag('alphaFlag');",
      "fixture.ts",
      FLAGS,
    );
    expect(result.refs.get("alphaFlag")).toBe(1);
    expect(result.occurrences.some((entry) => entry.name === "alphaFlag")).toBe(true);
  });

  it("detects FlagGate JSX attribute in TSX", async () => {
    await requireAst();
    const result = await scanTextForFlagsAST(
      'export const View = () => (<FlagGate name="betaFlag">ok</FlagGate>);',
      "fixture.tsx",
      FLAGS,
    );
    expect(result.refs.get("betaFlag")).toBe(1);
    expect(result.occurrences.some((entry) => entry.name === "betaFlag")).toBe(true);
  });
});
