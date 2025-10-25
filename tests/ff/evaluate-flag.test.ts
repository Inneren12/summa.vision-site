import { describe, expect, it } from "vitest";

import { evaluateFlag } from "../../lib/ff/runtime/evaluate-flag";
import type { FlagConfig } from "../../lib/ff/runtime/types";

describe("evaluateFlag", () => {
  const baseCtx = {
    stableId: "aid-1",
    userId: "user-1",
    namespace: "ns-1",
    tags: ["beta"],
  };
  const baseSeeds = { stableId: "aid-1" };

  function makeBaseConfig(): FlagConfig {
    return {
      key: "flag-1",
      enabled: true,
      kill: false,
      defaultValue: true,
      seedByDefault: "stableId",
      createdAt: 0,
      updatedAt: 0,
      segments: [
        {
          id: "seg-override",
          priority: 10,
          conditions: [{ field: "tag", op: "eq", value: "beta" }],
          override: false,
        },
        {
          id: "seg-rollout",
          priority: 20,
          conditions: [{ field: "tag", op: "eq", value: "beta" }],
          rollout: { percent: 100 },
        },
      ],
      rollout: { percent: 100 },
    } satisfies FlagConfig;
  }

  it("respects evaluation priority order", () => {
    const overrides = {
      user: { [baseCtx.userId!]: false },
      namespace: { [baseCtx.namespace!]: false },
    };

    const killConfig = makeBaseConfig();
    killConfig.kill = true;
    expect(
      evaluateFlag({
        cfg: killConfig,
        ctx: baseCtx,
        seeds: baseSeeds,
        overrides,
      }),
    ).toMatchObject({ reason: "killSwitch", value: false });

    const userOverrideConfig = makeBaseConfig();
    const userOverrideResult = evaluateFlag({
      cfg: userOverrideConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
      overrides,
    });
    expect(userOverrideResult).toMatchObject({
      reason: "userOverride",
      value: false,
    });

    const namespaceOverrideConfig = makeBaseConfig();
    const namespaceResult = evaluateFlag({
      cfg: namespaceOverrideConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
      overrides: { namespace: overrides.namespace },
    });
    expect(namespaceResult).toMatchObject({
      reason: "nsOverride",
      value: false,
    });

    const segmentOverrideConfig = makeBaseConfig();
    const segmentOverrideResult = evaluateFlag({
      cfg: segmentOverrideConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
    });
    expect(segmentOverrideResult).toMatchObject({
      reason: "segmentOverride",
      value: false,
      segmentId: "seg-override",
    });

    const segmentRolloutConfig = makeBaseConfig();
    const firstSegment = segmentRolloutConfig.segments![0];
    delete (firstSegment as { override?: boolean }).override;
    firstSegment.rollout = { percent: 100 };
    const segmentRolloutResult = evaluateFlag({
      cfg: segmentRolloutConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
    });
    expect(segmentRolloutResult).toMatchObject({
      reason: "segmentRollout",
      segmentId: "seg-override",
    });

    const globalRolloutConfig = makeBaseConfig();
    globalRolloutConfig.segments = [];
    const globalRolloutResult = evaluateFlag({
      cfg: globalRolloutConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
    });
    expect(globalRolloutResult).toMatchObject({ reason: "globalRollout" });

    const defaultConfig = makeBaseConfig();
    defaultConfig.segments = [];
    defaultConfig.rollout = { percent: 0 };
    const defaultResult = evaluateFlag({
      cfg: defaultConfig,
      ctx: baseCtx,
      seeds: baseSeeds,
    });
    expect(defaultResult).toMatchObject({ reason: "default", value: true });
  });

  it("uses cookie seed when seedBy is set to cookie", () => {
    const cfg: FlagConfig = {
      key: "flag-cookie",
      enabled: true,
      kill: false,
      defaultValue: "enabled",
      seedByDefault: "stableId",
      createdAt: 0,
      updatedAt: 0,
      rollout: { percent: 50, seedBy: "cookie" },
    };

    const seedsA = { ...baseSeeds, cookie: "cookie-a" };
    const seedsB = { ...baseSeeds, cookie: "cookie-b" };
    const pctFn = ({ seed }: { seed: string }) => (seed.includes("cookie-a") ? 10 : 90);

    const first = evaluateFlag({
      cfg,
      ctx: baseCtx,
      seeds: seedsA,
      rolloutPct: ({ seed, salt, percent, flagKey, segmentId }) => {
        void salt;
        void percent;
        void flagKey;
        void segmentId;
        return pctFn({ seed });
      },
    });
    const second = evaluateFlag({
      cfg,
      ctx: baseCtx,
      seeds: seedsB,
      rolloutPct: ({ seed, salt, percent, flagKey, segmentId }) => {
        void salt;
        void percent;
        void flagKey;
        void segmentId;
        return pctFn({ seed });
      },
    });

    expect(first.reason).toBe("globalRollout");
    expect(second.reason).toBe("default");
  });

  it("returns killValue when provided", () => {
    const cfg: FlagConfig = {
      key: "flag-kill",
      enabled: true,
      kill: true,
      killSwitch: true,
      killValue: null,
      defaultValue: true,
      seedByDefault: "stableId",
      createdAt: 0,
      updatedAt: 0,
    };

    const result = evaluateFlag({ cfg, ctx: baseCtx, seeds: baseSeeds });
    expect(result).toMatchObject({ reason: "killSwitch", value: null });
  });
});
