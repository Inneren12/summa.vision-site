import { z } from "zod";

export const SeedBySchema = z.enum([
  "stableId",
  "anonId",
  "user",
  "userId",
  "namespace",
  "cookie",
  "ipUa",
]);

export type SeedByInput = z.infer<typeof SeedBySchema>;

export const RolloutStepSchema = z
  .object({
    pct: z
      .number({ invalid_type_error: "pct must be a number" })
      .finite()
      .min(0, { message: "pct must be within [0..100]" })
      .max(100, { message: "pct must be within [0..100]" }),
    note: z.string().optional(),
    at: z.number().finite().optional(),
  })
  .strict();

export type RolloutStepInput = z.infer<typeof RolloutStepSchema>;

export const RolloutPlanSchema = z
  .object({
    percent: z
      .number({ invalid_type_error: "percent must be a number" })
      .finite()
      .min(0, { message: "percent must be within [0..100]" })
      .max(100, { message: "percent must be within [0..100]" })
      .optional(),
    salt: z.string().optional(),
    seedBy: SeedBySchema.optional(),
    seedByDefault: SeedBySchema.optional(),
    shadow: z.boolean().optional(),
    steps: z
      .array(RolloutStepSchema, {
        invalid_type_error: "steps must be an array of rollout steps",
      })
      .nonempty({ message: "steps must contain at least one entry" })
      .optional(),
    stop: z
      .object({
        maxErrorRate: z
          .number({ invalid_type_error: "maxErrorRate must be a number" })
          .finite()
          .min(0, { message: "maxErrorRate must be within [0..1]" })
          .max(1, { message: "maxErrorRate must be within [0..1]" })
          .optional(),
        maxCLS: z
          .number({ invalid_type_error: "maxCLS must be a number" })
          .finite()
          .min(0, { message: "maxCLS must be non-negative" })
          .optional(),
        maxINP: z
          .number({ invalid_type_error: "maxINP must be a number" })
          .finite()
          .min(0, { message: "maxINP must be non-negative" })
          .optional(),
      })
      .optional(),
    hysteresis: z
      .object({
        errorRate: z
          .number({ invalid_type_error: "errorRate must be a number" })
          .finite()
          .min(0, { message: "errorRate must be within [0..1]" })
          .max(1, { message: "errorRate must be within [0..1]" })
          .optional(),
        CLS: z
          .number({ invalid_type_error: "CLS must be a number" })
          .finite()
          .min(0, { message: "CLS must be non-negative" })
          .optional(),
        INP: z
          .number({ invalid_type_error: "INP must be a number" })
          .finite()
          .min(0, { message: "INP must be non-negative" })
          .optional(),
      })
      .optional(),
  })
  .strict();

export type RolloutPlanInput = z.infer<typeof RolloutPlanSchema>;

const SegmentConditionSchema = z.union([
  z
    .object({
      field: z.enum(["user", "namespace", "cookie", "ip", "ua"]),
      op: z.literal("eq"),
      value: z.string(),
    })
    .strict(),
  z.object({ field: z.literal("tag"), op: z.literal("eq"), value: z.string() }).strict(),
]);

export type SegmentConditionInput = z.infer<typeof SegmentConditionSchema>;

export const SegmentRuleSchema = z
  .object({
    id: z.string().min(1, { message: "segment id is required" }),
    name: z.string().optional(),
    priority: z.number({ invalid_type_error: "priority must be a number" }).finite(),
    conditions: z
      .array(SegmentConditionSchema, {
        invalid_type_error: "conditions must be an array of predicates",
      })
      .optional(),
    override: z.union([z.boolean(), z.string(), z.number()]).optional(),
    rollout: RolloutPlanSchema.optional(),
    namespace: z.string().optional(),
  })
  .strict();

export type SegmentRuleInput = z.infer<typeof SegmentRuleSchema>;

export const FlagConfigSchema = z
  .object({
    key: z.string().min(1, { message: "flag key is required" }),
    namespace: z.string().optional(),
    version: z.number().finite().optional(),
    description: z.string().optional(),
    enabled: z.boolean({ invalid_type_error: "enabled must be boolean" }),
    kill: z.boolean().optional(),
    killSwitch: z.boolean().optional(),
    seedByDefault: SeedBySchema.optional(),
    defaultValue: z.union([z.boolean(), z.string(), z.number()]),
    tags: z.array(z.string()).optional(),
    rollout: RolloutPlanSchema.optional(),
    segments: z
      .array(SegmentRuleSchema, {
        invalid_type_error: "segments must be an array of segment rules",
      })
      .nonempty({ message: "segments must contain at least one segment" })
      .optional(),
    createdAt: z.number({ invalid_type_error: "createdAt must be a number" }).finite(),
    updatedAt: z.number({ invalid_type_error: "updatedAt must be a number" }).finite(),
  })
  .strict();

export type FlagConfigInput = z.infer<typeof FlagConfigSchema>;

export const FlagConfigListSchema = z
  .array(FlagConfigSchema, {
    invalid_type_error: "flags must be an array of flag configs",
  })
  .superRefine((flags, ctx) => {
    const seen = new Map<string, number>();
    for (const [index, flag] of flags.entries()) {
      const key = `${flag.namespace ?? ""}@@${flag.key}`;
      if (seen.has(key)) {
        const firstIndex = seen.get(key)!;
        const message =
          flag.namespace && flag.namespace.length > 0
            ? `Duplicate flag key "${flag.key}" within namespace "${flag.namespace}"`
            : `Duplicate flag key "${flag.key}" within default namespace`;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [index, "key"],
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [firstIndex, "key"],
        });
      } else {
        seen.set(key, index);
      }
    }
  });

export type FlagConfigListInput = z.infer<typeof FlagConfigListSchema>;
