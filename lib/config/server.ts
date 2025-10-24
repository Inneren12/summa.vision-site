import "server-only";
import { z } from "zod";

import { getServerEnv } from "../env.server";

import { ServerConfigSchema, type ServerConfig } from "./schema";

/**
 * Слой defaults → ENV.
 * Флаги НЕ могут менять приватные значения (секреты/endpoint'ы) — только ENV.
 */
const Defaults = {
  enableCsp: true as boolean,
};

// Схема ENV для приватных значений, чтобы аккуратно их разобрать и сконвертировать из строк
const ServerConfigEnvSchema = z.object({
  INTERNAL_API_BASE: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  ENABLE_CSP: z.enum(["true", "false"]).optional(),
  APP_ENV: z.enum(["local", "development", "staging", "production"]).optional(),
});

export function getAppConfig(): Readonly<ServerConfig> {
  const env = getServerEnv(); // валидировано S2-A
  const parsed = ServerConfigEnvSchema.parse(process.env);

  const cfg: ServerConfig = {
    nodeEnv: env.NODE_ENV,
    appEnv: parsed.APP_ENV ?? env.APP_ENV ?? "local",
    internalApiBase: parsed.INTERNAL_API_BASE,
    databaseUrl: parsed.DATABASE_URL,
    enableCsp: parsed.ENABLE_CSP ? parsed.ENABLE_CSP === "true" : Defaults.enableCsp,
  };
  return Object.freeze(ServerConfigSchema.parse(cfg));
}
