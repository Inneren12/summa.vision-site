import { z } from "zod";

// --- Strict unions for FlagValue (S2-A already supports structured values) ---
export const RolloutConfigSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().min(0).max(100).optional(),
  salt: z.string().max(64).optional(),
});
export type RolloutConfig = z.infer<typeof RolloutConfigSchema>;

export const FlagValueSchema = z.union([z.boolean(), z.number(), z.string(), RolloutConfigSchema]);
export type FlagValue = boolean | number | string | RolloutConfig;

export const FeatureFlagsSchema = z.record(FlagValueSchema);
export type FeatureFlags = Record<string, FlagValue>;

export function parseFlagsJson(raw?: string | null): FeatureFlags {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return FeatureFlagsSchema.parse(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid FEATURE_FLAGS_JSON: ${msg}`);
  }
}

export function mergeFlags(...all: Array<FeatureFlags | undefined | null>): FeatureFlags {
  return all.reduce<FeatureFlags>((acc, cur) => {
    if (!cur) return acc;
    for (const key of Object.keys(cur)) {
      acc[key] = cur[key];
    }
    return acc;
  }, {});
}
