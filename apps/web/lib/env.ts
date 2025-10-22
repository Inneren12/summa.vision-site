import { z } from "zod";

type ZodObjectShape = z.ZodObject<z.ZodRawShape>;

type InferEnv<TSchema extends ZodObjectShape> = z.infer<TSchema>;

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1, "NEXT_PUBLIC_APP_NAME must not be empty"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url("NEXT_PUBLIC_API_BASE_URL must be a valid URL"),
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
