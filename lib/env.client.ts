import { z } from "zod";

export const ClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "development", "staging", "production"]).optional(),
  NEXT_PUBLIC_FEATURE_FLAGS_JSON: z.string().optional(),
  NEXT_PUBLIC_DEV_TOOLS: z.enum(["true", "false"]).optional(),
});
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

/** Parse validated client env (safe for client bundling). */
export function getClientEnv(): Readonly<ClientEnv> {
  const env = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV as ClientEnv["NEXT_PUBLIC_APP_ENV"],
    NEXT_PUBLIC_FEATURE_FLAGS_JSON: process.env.NEXT_PUBLIC_FEATURE_FLAGS_JSON,
    NEXT_PUBLIC_DEV_TOOLS: process.env.NEXT_PUBLIC_DEV_TOOLS as ClientEnv["NEXT_PUBLIC_DEV_TOOLS"],
  };
  const parsed = ClientEnvSchema.parse(env);
  return Object.freeze(parsed);
}
