import { z } from "zod";

import { FLAG_REGISTRY, isKnownFlag, knownFlags } from "./flags";

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

const SegmentWhereStringSchema = z
  .object({
    field: z.string().min(1),
    op: z.enum(["eq", "startsWith", "contains"]),
    value: z.string(),
  })
  .strict();

const SegmentWhereNumberSchema = z
  .object({
    field: z.string().min(1),
    op: z.enum(["eq", "gt", "lt"]),
    value: z.number({ invalid_type_error: "value must be a number" }).finite(),
  })
  .strict();

const SegmentWhereBetweenSchema = z
  .object({
    field: z.string().min(1),
    op: z.literal("between"),
    min: z.number({ invalid_type_error: "min must be a number" }).finite(),
    max: z.number({ invalid_type_error: "max must be a number" }).finite(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.min > value.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "between.min must be <= between.max",
      });
    }
  });

const SegmentWhereListSchema = z
  .object({
    field: z.string().min(1),
    op: z.enum(["in", "notIn"]),
    values: z.array(z.string()).min(1, { message: "values must not be empty" }),
  })
  .strict();

const SegmentWhereGlobSchema = z
  .object({
    field: z.literal("path"),
    op: z.literal("glob"),
    value: z.string(),
  })
  .strict();

const SegmentWhereSchema = z.union([
  SegmentWhereStringSchema,
  SegmentWhereNumberSchema,
  SegmentWhereBetweenSchema,
  SegmentWhereListSchema,
  SegmentWhereGlobSchema,
]);

const LegacySegmentConditionSchema = z.union([
  z
    .object({
      field: z.enum(["user", "namespace", "cookie", "ip", "ua"]),
      op: z.literal("eq"),
      value: z.string(),
    })
    .strict(),
  z.object({ field: z.literal("tag"), op: z.literal("eq"), value: z.string() }).strict(),
]);

export type SegmentConditionInput = z.infer<typeof LegacySegmentConditionSchema>;

export const SegmentRuleSchema = z
  .object({
    id: z.string().min(1, { message: "segment id is required" }),
    name: z.string().optional(),
    priority: z.number({ invalid_type_error: "priority must be a number" }).finite(),
    where: z
      .array(SegmentWhereSchema, {
        invalid_type_error: "where must be an array of predicates",
      })
      .optional(),
    conditions: z
      .array(LegacySegmentConditionSchema, {
        invalid_type_error: "conditions must be an array of predicates",
      })
      .optional(),
    override: z.union([z.boolean(), z.string(), z.number()]).optional(),
    rollout: RolloutPlanSchema.optional(),
    namespace: z.string().optional(),
  })
  .strict();

export type SegmentRuleInput = z.infer<typeof SegmentRuleSchema>;

const KillValueSchema = z.union([z.boolean(), z.number(), z.string(), z.null()]);

export const FlagConfigSchema = z
  .object({
    key: z.string().min(1, { message: "flag key is required" }),
    namespace: z.string().optional(),
    version: z.number().finite().optional(),
    description: z.string().optional(),
    enabled: z.boolean({ invalid_type_error: "enabled must be boolean" }),
    kill: z.boolean().optional(),
    killSwitch: z.boolean().optional(),
    killValue: KillValueSchema.optional(),
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

export type SchemaReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && Object.getPrototypeOf(x) === Object.prototype;
}

function t(v: unknown): string {
  if (v === null) return "null";
  const tp = typeof v;
  if (tp !== "object") return tp;
  return Array.isArray(v) ? "array" : "object";
}

function validateRollout(name: string, v: unknown, errors: string[], warnings: string[]) {
  // Разрешаем boolean (форс‑ON/OFF), но рекомендуем объект
  if (typeof v === "boolean") {
    warnings.push(`${name}: rollout configured as boolean; prefer {enabled, percent?, salt?}`);
    return;
  }
  if (!isPlainObject(v)) {
    errors.push(`${name}: rollout must be object or boolean (got ${t(v)})`);
    return;
  }
  const rollout = v as Record<string, unknown>;
  if (typeof rollout.enabled !== "boolean") errors.push(`${name}: "enabled" must be boolean`);
  if ("percent" in rollout) {
    if (typeof rollout.percent !== "number" || !Number.isFinite(rollout.percent)) {
      errors.push(`${name}: "percent" must be number`);
    } else if (rollout.percent < 0 || rollout.percent > 100) {
      errors.push(`${name}: "percent" out of range [0..100]`);
    }
  }
  if ("salt" in rollout && typeof rollout.salt !== "string") {
    errors.push(`${name}: "salt" must be string`);
  }
  if ("shadow" in rollout && typeof rollout.shadow !== "boolean") {
    errors.push(`${name}: "shadow" must be boolean`);
  }
}

function validateVariant(name: string, v: unknown, errors: string[], warnings: string[]) {
  // override‑строка допускается в cookie/global, НО в ENV ждём объект конфигурации
  if (!isPlainObject(v)) {
    errors.push(`${name}: variant must be object (got ${t(v)})`);
    return;
  }
  const variantConfig = v as Record<string, unknown>;
  const variants = variantConfig.variants as Record<string, unknown> | undefined;
  if (!isPlainObject(variants) || Object.keys(variants).length === 0) {
    errors.push(`${name}: "variants" must be non-empty object`);
    return;
  }
  let sum = 0;
  for (const [k, w] of Object.entries(variants)) {
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0) {
      errors.push(`${name}: variants["${k}"] must be non-negative number`);
    }
    sum += Number(w);
  }
  if (process.env.NODE_ENV === "production") {
    if (Math.abs(sum - 100) > 1e-9)
      errors.push(`${name}: sum(variants) must equal 100 (got ${sum})`);
  } else {
    if (Math.abs(sum - 100) > 1e-6)
      warnings.push(`${name}: sum(variants) is ${sum} (will normalize in dev)`);
  }
  if ("salt" in variantConfig && typeof variantConfig.salt !== "string")
    errors.push(`${name}: "salt" must be string`);
  if ("enabled" in variantConfig && typeof variantConfig.enabled !== "boolean")
    errors.push(`${name}: "enabled" must be boolean`);
  if ("defaultVariant" in variantConfig) {
    if (typeof variantConfig.defaultVariant !== "string") {
      errors.push(`${name}: "defaultVariant" must be string`);
    } else if (isPlainObject(variants) && !(variantConfig.defaultVariant in variants)) {
      warnings.push(`${name}: "defaultVariant" not in variants`);
    }
  }
}

/** Валидирует объект ENV‑флагов против реестра. */
export function validateFeatureFlagsObject(obj: unknown): SchemaReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (obj === undefined) {
    return { ok: true, errors, warnings };
  }
  if (!isPlainObject(obj)) {
    errors.push(`FEATURE_FLAGS_JSON must be object (got ${t(obj)})`);
    return { ok: errors.length === 0, errors, warnings };
  }

  for (const [name, val] of Object.entries(obj)) {
    if (!isKnownFlag(name)) {
      // Для ENV — предупреждение (не ломаем запуск), строгий режим — опционально в будущем.
      warnings.push(`Unknown flag in ENV: "${name}" (known: ${knownFlags().join(", ")})`);
      continue;
    }
    const meta = FLAG_REGISTRY[name];
    switch (meta.type) {
      case "boolean":
        if (typeof val !== "boolean") errors.push(`${name}: must be boolean (got ${t(val)})`);
        break;
      case "string":
        if (typeof val !== "string") errors.push(`${name}: must be string (got ${t(val)})`);
        else if (val.length > 256) errors.push(`${name}: string too long (>256)`);
        break;
      case "number":
        if (typeof val !== "number" || !Number.isFinite(val))
          errors.push(`${name}: must be number`);
        else if (val < -1e6 || val > 1e6) errors.push(`${name}: number out of range [-1e6..1e6]`);
        break;
      case "rollout":
        validateRollout(name, val, errors, warnings);
        break;
      case "variant":
        validateVariant(name, val, errors, warnings);
        break;
      default:
        warnings.push(`${name}: unsupported type in registry`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Парсит JSON‑строку ENV и возвращает отчёт валидации (без утечки содержимого). */
export function validateFeatureFlagsEnvString(envJson?: string | null): SchemaReport {
  if (!envJson || envJson.trim() === "") return { ok: true, errors: [], warnings: [] };
  try {
    const obj = JSON.parse(envJson);
    return validateFeatureFlagsObject(obj);
  } catch {
    return { ok: false, errors: ["FEATURE_FLAGS_JSON: malformed JSON"], warnings: [] };
  }
}

// Единоразовый dev‑варнинг при изменении ENV (без утечки содержимого).
let __lastSig: string | undefined;
export function devWarnFeatureFlagsSchemaOnce() {
  if (process.env.NODE_ENV === "production") return;
  const sig =
    String(process.env.FEATURE_FLAGS_JSON || "").length +
    ":" +
    (process.env.FEATURE_FLAGS_JSON || "").slice(0, 2);
  if (sig === __lastSig) return;
  __lastSig = sig;
  const report = validateFeatureFlagsEnvString(process.env.FEATURE_FLAGS_JSON);
  if (!report.ok || report.warnings.length) {
    // eslint-disable-next-line no-console
    console.warn("[flags][schema]", {
      ok: report.ok,
      errors: report.errors,
      warnings: report.warnings,
    });
  }
}
