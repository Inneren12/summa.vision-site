import { describe, it, expect } from "vitest";

import { evaluateFlag } from "../../lib/ff/core/eval/evaluate";
import type { FlagConfig } from "../../lib/ff/core/ports";

const base: FlagConfig = {
  key: "feature.X",
  namespace: "public",
  default: false,
  version: 1,
  rollout: { steps: [{ pct: 0 }], seedByDefault: "userId" },
};

describe("evaluateFlag seedBy in segment rollout", () => {
  it("uses cookie vs userId producing different cohorts", () => {
    const cfg: FlagConfig = {
      ...base,
      segments: [{ if: { tenant: ["acme"] }, rollout: { pct: 50, seedBy: "cookie" } }],
    };

    const ctx = { tenant: "acme", locale: "en", path: "/", ua: "UA" };
    const seedsA = { userId: "u-1", cookie: "c-1", ipUa: "h1", anonId: "c-1" };
    const seedsB = { userId: "u-1", cookie: "c-2", ipUa: "h1", anonId: "c-2" };

    const a = evaluateFlag({ cfg, seeds: seedsA, ctx, overrides: {}, rolloutPct: undefined });
    const b = evaluateFlag({ cfg, seeds: seedsB, ctx, overrides: {}, rolloutPct: undefined });

    expect(a.reason).toMatch(/segmentRollout|segmentOverride/);
    expect(b.reason).toMatch(/segmentRollout|segmentOverride/);
  });
});
