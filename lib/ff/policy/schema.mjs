import { z } from "zod";

const NonEmptyString = z
  .string({ invalid_type_error: "value must be a string" })
  .trim()
  .min(1, { message: "value must be a non-empty string" });

const PercentSchema = z
  .number({ invalid_type_error: "steps entries must be numbers" })
  .finite({ message: "steps entries must be finite numbers" })
  .min(0, { message: "percent must be within [0..100]" })
  .max(100, { message: "percent must be within [0..100]" });

const StepsSchema = z
  .array(PercentSchema, {
    invalid_type_error: "steps must be an array of rollout percentages",
  })
  .nonempty({ message: "steps must contain at least one entry" })
  .superRefine((steps, ctx) => {
    for (let idx = 1; idx < steps.length; idx += 1) {
      const prev = steps[idx - 1];
      const current = steps[idx];
      if (current <= prev) {
        const duplicate = current === prev;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx],
          message: duplicate
            ? `steps[${idx}] (${current}) must be greater than previous value ${prev} (duplicate step)`
            : `steps[${idx}] (${current}) must be greater than previous value ${prev}`,
        });
      }
    }
  });

const StopSchema = z
  .object({
    maxErrorRate: z
      .number({ invalid_type_error: "maxErrorRate must be a number" })
      .finite({ message: "maxErrorRate must be finite" })
      .min(0, { message: "maxErrorRate must be within [0..1]" })
      .max(1, { message: "maxErrorRate must be within [0..1]" })
      .optional(),
    maxCLS: z
      .number({ invalid_type_error: "maxCLS must be a number" })
      .finite({ message: "maxCLS must be finite" })
      .min(0, { message: "maxCLS must be within [0..1]" })
      .max(1, { message: "maxCLS must be within [0..1]" })
      .optional(),
    maxINP: z
      .number({ invalid_type_error: "maxINP must be a number" })
      .finite({ message: "maxINP must be finite" })
      .min(0, { message: "maxINP must be within [0..10000]" })
      .max(10000, { message: "maxINP must be within [0..10000]" })
      .optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "stop must define at least one threshold",
  });

const HysteresisSchema = z
  .object({
    errorRate: z
      .number({ invalid_type_error: "hysteresis.errorRate must be a number" })
      .finite({ message: "hysteresis.errorRate must be finite" })
      .min(0, { message: "hysteresis.errorRate must be within [0..1]" })
      .max(1, { message: "hysteresis.errorRate must be within [0..1]" })
      .optional(),
    CLS: z
      .number({ invalid_type_error: "hysteresis.CLS must be a number" })
      .finite({ message: "hysteresis.CLS must be finite" })
      .min(0, { message: "hysteresis.CLS must be within [0..1]" })
      .max(1, { message: "hysteresis.CLS must be within [0..1]" })
      .optional(),
    cls: z
      .number({ invalid_type_error: "hysteresis.cls must be a number" })
      .finite({ message: "hysteresis.cls must be finite" })
      .min(0, { message: "hysteresis.cls must be within [0..1]" })
      .max(1, { message: "hysteresis.cls must be within [0..1]" })
      .optional(),
    INP: z
      .number({ invalid_type_error: "hysteresis.INP must be a number" })
      .finite({ message: "hysteresis.INP must be finite" })
      .min(0, { message: "hysteresis.INP must be within [0..10000]" })
      .max(10000, { message: "hysteresis.INP must be within [0..10000]" })
      .optional(),
    inp: z
      .number({ invalid_type_error: "hysteresis.inp must be a number" })
      .finite({ message: "hysteresis.inp must be finite" })
      .min(0, { message: "hysteresis.inp must be within [0..10000]" })
      .max(10000, { message: "hysteresis.inp must be within [0..10000]" })
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!Object.values(value).some((entry) => entry !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "hysteresis must define at least one threshold",
      });
      return;
    }
    if (value.CLS !== undefined && value.cls !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cls"],
        message: "Specify either hysteresis.CLS or hysteresis.cls, not both",
      });
    }
    if (value.INP !== undefined && value.inp !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inp"],
        message: "Specify either hysteresis.INP or hysteresis.inp, not both",
      });
    }
  })
  .transform((value) => ({
    errorRate: value.errorRate,
    CLS: value.CLS ?? value.cls,
    INP: value.INP ?? value.inp,
  }));

const ShadowSchema = z
  .preprocess(
    (value) => {
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
      }
      return value;
    },
    z.boolean({ invalid_type_error: "shadow must be a boolean" }),
  )
  .optional();

const TokenSchema = z
  .string({ invalid_type_error: "token must be a string" })
  .trim()
  .min(1, { message: "token must be a non-empty string" })
  .optional();

export const RolloutPolicySchema = z
  .object({
    host: z
      .string({ invalid_type_error: "host must be a string" })
      .trim()
      .min(1, { message: "host must be a non-empty string" })
      .default("http://localhost:3000"),
    flag: NonEmptyString.describe("Flag key to rollout"),
    ns: NonEmptyString.describe("Namespace for rollout analytics").optional(),
    steps: StepsSchema,
    stop: StopSchema.optional(),
    minSamples: z
      .number({ invalid_type_error: "minSamples must be a number" })
      .int({ message: "minSamples must be an integer" })
      .min(0, { message: "minSamples must be >= 0" })
      .optional(),
    coolDownMs: z
      .number({ invalid_type_error: "coolDownMs must be a number" })
      .int({ message: "coolDownMs must be an integer" })
      .min(0, { message: "coolDownMs must be >= 0" })
      .optional(),
    hysteresis: HysteresisSchema.optional(),
    token: TokenSchema,
    shadow: ShadowSchema,
  })
  .strict()
  .transform((value) => ({
    ...value,
    host: value.host ?? "http://localhost:3000",
    token: value.token ?? undefined,
    shadow: value.shadow ?? undefined,
  }));

export class RolloutPolicyValidationError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = "RolloutPolicyValidationError";
    this.issues = issues;
  }
}

export function formatRolloutPolicyIssues(issues) {
  return issues
    .map((issue) => {
      const path = issue.path && issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

export function parseRolloutPolicy(input) {
  const result = RolloutPolicySchema.safeParse(input);
  if (!result.success) {
    throw new RolloutPolicyValidationError(
      formatRolloutPolicyIssues(result.error.issues),
      result.error.issues,
    );
  }
  return result.data;
}
