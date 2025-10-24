import type { FlagConfig, OverrideValue, SegCtx, Seeds } from "../ports";

import { pctHit, getSeedValue } from "./hash";
import { matches } from "./segments";

export function evaluateFlag(params: {
  cfg: FlagConfig;
  seeds: Seeds;
  ctx: SegCtx;
  overrides: { user?: OverrideValue; ns?: OverrideValue; global?: OverrideValue };
  rolloutPct?: number;
}): { value: boolean; reason: string } {
  const { cfg, overrides, seeds, ctx, rolloutPct } = params;

  if (cfg.killSwitch) return { value: false, reason: "killSwitch" };
  if (overrides.user) return { value: overrides.user.value, reason: "userOverride" };
  if (overrides.ns) return { value: overrides.ns.value, reason: "nsOverride" };
  if (overrides.global) return { value: overrides.global.value, reason: "globalOverride" };

  if (cfg.segments) {
    for (const rule of cfg.segments) {
      if (!matches(ctx, rule)) continue;

      if (rule.override !== undefined) {
        return { value: rule.override, reason: "segmentOverride" };
      }

      if (rule.rollout) {
        const seedVal = getSeedValue(
          rule.rollout.seedBy,
          seeds,
          cfg.rollout?.seedByDefault ?? "userId",
        );
        const seed = `${cfg.key}|${cfg.namespace}|seg|${seedVal}`;
        const on = pctHit(seed, rule.rollout.pct);
        return { value: on, reason: "segmentRollout" };
      }
    }
  }

  const pct =
    typeof rolloutPct === "number" ? rolloutPct : (cfg.rollout?.steps?.[0]?.pct ?? undefined);

  if (typeof pct === "number") {
    const seedVal = getSeedValue(cfg.rollout?.seedByDefault, seeds, "userId");
    const seed = `${cfg.key}|${cfg.namespace}|${seedVal}`;
    const on = pctHit(seed, pct);
    return { value: on, reason: "globalRollout" };
  }

  return { value: cfg.default, reason: "default" };
}
