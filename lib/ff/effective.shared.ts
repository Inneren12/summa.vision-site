import { inRollout } from "./hash";
import type { FeatureFlags, FlagValue } from "./shared";

export type EffectiveFlagValue = boolean | number | string;
export type EffectiveFlags = Record<string, EffectiveFlagValue>;

function evaluateRollout(
  name: string,
  value: Extract<FlagValue, { enabled: boolean }>,
  stableId?: string,
): boolean {
  if (!value.enabled) return false;
  const percent = typeof value.percent === "number" ? value.percent : 100;
  const salt = value.salt ?? name;
  const id = stableId || "__anonymous__";
  return inRollout(id, percent, salt);
}

function evaluateFlag(name: string, value: FlagValue, stableId?: string): EffectiveFlagValue {
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  return evaluateRollout(name, value, stableId);
}

export function computeEffectiveFlags(flags: FeatureFlags, stableId?: string): EffectiveFlags {
  const out: EffectiveFlags = {};
  for (const [key, value] of Object.entries(flags)) {
    out[key] = evaluateFlag(key, value, stableId);
  }
  return out;
}
