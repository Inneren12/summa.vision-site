import { describe, it, expect } from "vitest";

import { scanTextForFlags } from "../../scripts/doctor/scan.js";

describe("scanTextForFlags", () => {
  it('finds useFlag(), JSX name="" and query ?ff=', () => {
    const flags = ["betaUI", "bannerText", "newCheckout"];
    const sample = `
      // comment: useFlag('betaUI') should be ignored here
      const on = useFlag('betaUI');
      const text = useFlag("bannerText");
      const X = () => <FlagGateServer name="newCheckout">ok</FlagGateServer>;
      const Y = () => <PercentGate name={'betaUI'} />;
      const link = "/api/ff-override?ff=unknownFlag:true";
      const preview = "?ff=bannerText:true";
      const falsePos = const betaUIEnabled = 1; // not a real use
    `;
    const { refs, fuzzyRefs, unknown, occurrences } = scanTextForFlags(sample, flags);
    expect(refs.get("betaUI")).toBeGreaterThanOrEqual(2);
    expect(refs.get("bannerText")).toBeGreaterThanOrEqual(1);
    expect(refs.get("newCheckout")).toBeGreaterThanOrEqual(1);
    expect(fuzzyRefs.get("bannerText")).toBeGreaterThanOrEqual(1);
    expect(Array.from(unknown.keys())).toContain("unknownFlag");
    const queryHit = occurrences.find((o) => o.name === "bannerText" && o.fuzzy);
    expect(queryHit?.fuzzy).toBe(true);
    const hookHit = occurrences.find((o) => o.name === "betaUI" && o.kind === "hook");
    expect(hookHit?.fuzzy).toBe(false);
  });
});
