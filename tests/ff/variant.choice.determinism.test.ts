import { describe, it, expect } from "vitest";

import { chooseVariant } from "@/lib/ff/variant";

describe("Variants determinism", () => {
  it("same id+salt => same variant", () => {
    const w = { control: 50, treatment: 50 };
    const a = chooseVariant("u:123", "exp1", w);
    const b = chooseVariant("u:123", "exp1", w);
    expect(a).toBe(b);
  });
  it("different salt reshuffles", () => {
    const w = { control: 50, treatment: 50 };
    const a = chooseVariant("u:123", "exp1", w);
    const b = chooseVariant("u:123", "exp2", w);
    let changed = a !== b;
    for (let i = 0; i < 10 && !changed; i++) {
      const id = `u:${1000 + i}`;
      if (chooseVariant(id, "exp1", w) !== chooseVariant(id, "exp2", w)) changed = true;
    }
    expect(changed).toBe(true);
  });
});
