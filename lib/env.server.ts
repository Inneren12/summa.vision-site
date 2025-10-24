import "server-only";
import { z } from "zod";

export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "development", "staging", "production"]).optional(),
  NEXT_RUNTIME: z.enum(["edge", "nodejs"]).optional(),
  FEATURE_FLAGS_JSON: z.string().optional(),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let _serverEnv: Readonly<ServerEnv> | null = null;

/** Parse + cache validated server env (server-only). */
export function getServerEnv(): Readonly<ServerEnv> {
  if (_serverEnv) return _serverEnv;
  const parsed = ServerEnvSchema.parse(process.env);
  _serverEnv = Object.freeze(parsed);
  return _serverEnv;
}

/** Guard: do not expose non-public env keys to client. */
export function assertNoPublicLeak(obj: Record<string, unknown>) {
  const forbidden = Object.keys(obj).filter((k) => !k.startsWith("NEXT_PUBLIC_"));
  if (forbidden.length) {
    throw new Error(
      `Attempted to expose non-public env keys to the client: ${forbidden.join(", ")}. ` +
        `Only NEXT_PUBLIC_* keys are allowed.`,
    );
  }
}

/** tests-only: reset cached env */
export function __resetServerEnvCacheForTests() {
  _serverEnv = null;
}
