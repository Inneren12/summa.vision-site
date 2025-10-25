import { z } from "zod";

const booleanish = z
  .preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "") return undefined;
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
    }
    return value;
  }, z.boolean())
  .optional();

const numberish = z
  .preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return undefined;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? NaN : parsed;
    }
    return value;
  }, z.number())
  .optional();

const optionalString = z
  .preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return value;
  }, z.string())
  .optional();

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADMIN_TOKENS: optionalString,
  FF_COOKIE_DOMAIN: optionalString,
  FF_COOKIE_PATH: optionalString,
  FF_COOKIE_SECURE: booleanish,
  REDIS_URL: optionalString,
  ROLLOUT_LOCK_TTL_MS: numberish,
  METRICS_WINDOW_MS: numberish,
  NEXT_PUBLIC_DEV_TOOLS: booleanish,
});

export type EnvSchemaShape = z.infer<typeof EnvSchema>;
