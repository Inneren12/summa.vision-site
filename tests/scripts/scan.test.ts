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
      const falsePos = const betaUIEnabled = 1; // not a real use
    `;
    const { refs, unknown } = scanTextForFlags(sample, flags);
    expect(refs.get("betaUI")).toBeGreaterThanOrEqual(2);
    expect(refs.get("bannerText")).toBeGreaterThanOrEqual(1);
    expect(refs.get("newCheckout")).toBeGreaterThanOrEqual(1);
    expect(Array.from(unknown.keys())).toContain("unknownFlag");
  });
});
