import { FLAG_REGISTRY, type FlagName, type EffectiveFlags } from "./flags";
import { inRollout } from "./hash";
import { type FeatureFlags, type RolloutConfig, type VariantConfig } from "./shared";
import { chooseVariant, validateOrNormalizeWeights } from "./variant";
import { warnFlagTypeMismatch, typeOfValue } from "./warn";

function isRolloutConfig(value: unknown): value is RolloutConfig {
  if (typeof value !== "object" || value === null) return false;
  if (!("enabled" in value)) return false;
  return typeof (value as { enabled: unknown }).enabled === "boolean";
}

/** Разрешить значение флага согласно реестру, учитывая overrides и percent rollout. */
export function resolveEffectiveFlag(
  name: FlagName,
  raw: unknown,
  stableId: string,
): boolean | string | number {
  const meta = FLAG_REGISTRY[name];

  if (meta.type === "variant") {
    if (typeof raw === "string") return raw;
    const def = meta.defaultValue as VariantConfig;
    const cfg = (
      raw && typeof raw === "object" && raw !== null ? (raw as VariantConfig) : def
    ) as VariantConfig;
    const enabled = cfg.enabled !== false;
    const variants = cfg.variants || def.variants || {};
    const salt = cfg.salt ?? name;
    const keys = Object.keys(variants);
    const preferredFallback = cfg.defaultVariant ?? def.defaultVariant;
    const fallback =
      preferredFallback && Object.prototype.hasOwnProperty.call(variants, preferredFallback)
        ? preferredFallback
        : (keys[0] ?? "");
    if (!keys.length) return fallback;
    if (!enabled) return fallback;
    const strict = process.env.NODE_ENV === "production";
    const norm = validateOrNormalizeWeights(variants, strict);
    if (!norm.ok) {
      return fallback;
    }
    return chooseVariant(stableId, salt, norm.weights as Record<string, number>);
  }

  if (meta.type === "rollout") {
    if (typeof raw === "boolean") return raw;
    const defaultConfig = meta.defaultValue;
    const candidate = raw ?? defaultConfig;
    if (!isRolloutConfig(candidate)) {
      if (typeof raw !== "undefined") {
        warnFlagTypeMismatch(name, "RolloutConfig or boolean override", typeOfValue(raw));
      }
      if (!defaultConfig.enabled) return false;
      const percent = typeof defaultConfig.percent === "number" ? defaultConfig.percent : 100;
      const salt = defaultConfig.salt ?? name;
      return inRollout(stableId, percent, salt);
    }
    if (!candidate.enabled) return false;
    const percent = typeof candidate.percent === "number" ? candidate.percent : 100;
    const salt = candidate.salt ?? name;
    return inRollout(stableId, percent, salt);
  }

  if (meta.type === "boolean") {
    return typeof raw === "boolean" ? raw : meta.defaultValue;
  }
  if (meta.type === "string") {
    return typeof raw === "string" ? raw : meta.defaultValue;
  }
  // number
  return typeof raw === "number" ? raw : meta.defaultValue;
}

/** Построить карту эффективных флагов только по известным именам из реестра. */
export function resolveEffectiveFlags(stableId: string, merged: FeatureFlags): EffectiveFlags {
  const result: Partial<EffectiveFlags> = {};
  for (const name of Object.keys(FLAG_REGISTRY) as FlagName[]) {
    const rawValue = Object.prototype.hasOwnProperty.call(merged, name) ? merged[name] : undefined;
    result[name] = resolveEffectiveFlag(name, rawValue, stableId) as EffectiveFlags[typeof name];
  }
  return result as EffectiveFlags;
}
