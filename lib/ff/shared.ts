import { z } from "zod";

// --- Strict unions for FlagValue (S2-A already supports structured values) ---
const RolloutSeedBySchema = z.enum([
  "stableId",
  "anonId",
  "user",
  "userId",
  "namespace",
  "cookie",
  "ipUa",
]);

export const RolloutShadowSchema = z
  .object({
    pct: z.number().min(0).max(100),
    seedBy: RolloutSeedBySchema.optional(),
  })
  .strict();
export type RolloutShadowConfig = z.infer<typeof RolloutShadowSchema>;

export const RolloutConfigSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().min(0).max(100).optional(),
  salt: z.string().max(64).optional(),
  shadow: RolloutShadowSchema.optional(),
});
export type RolloutConfig = z.infer<typeof RolloutConfigSchema>;

export const VariantConfigSchema = z.object({
  enabled: z.boolean().optional(),
  variants: z.record(z.number()).refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one variant",
  }),
  salt: z.string().max(128).optional(),
  defaultVariant: z.string().max(128).optional(),
});
export type VariantConfig = z.infer<typeof VariantConfigSchema>;

export const FlagValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  RolloutConfigSchema,
  VariantConfigSchema,
]);
export type FlagValue = boolean | number | string | RolloutConfig | VariantConfig;

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
