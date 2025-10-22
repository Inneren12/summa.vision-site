import { z } from "zod";

type ZodObjectShape = z.ZodObject<z.ZodRawShape>;

type InferEnv<TSchema extends ZodObjectShape> = z.infer<TSchema>;

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  SENTRY_DSN: z
    .preprocess((value) => {
      if (typeof value !== "string" || value.length === 0) {
        return undefined;
      }

      return value;
    }, z.string().url())
    .optional(),
  SENTRY_ENV: z.enum(["development", "staging", "production"]).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z
    .preprocess((value) => {
      if (value === undefined || value === "") {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number().min(0).max(1))
    .optional(),
  CSP_REPORT_ONLY: z.enum(["0", "1"]).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1, "NEXT_PUBLIC_APP_NAME must not be empty"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url("NEXT_PUBLIC_API_BASE_URL must be a valid URL"),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
});

const load = <TSchema extends ZodObjectShape>(schema: TSchema) => {
  const result = schema.safeParse(
    Object.fromEntries(Object.keys(schema.shape).map((key) => [key, process.env[key]])),
  );

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join(", ");

    throw new Error(`Invalid environment variables: ${message}`);
  }

  return result.data as InferEnv<TSchema>;
};

const server = load(serverSchema);
const client = load(clientSchema);

export const env = {
  ...server,
  ...client,
} as const;

export type Env = typeof env;
