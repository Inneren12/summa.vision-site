import { z } from "zod";

/**
 * Публичный конфиг (можно сериализовать в клиент).
 * Только на основе NEXT_PUBLIC_* переменных.
 */
export const PublicConfigSchema = z.object({
  appEnv: z.enum(["local", "development", "staging", "production"]),
  devTools: z.boolean().default(false),
  siteUrl: z.string().min(1).optional(),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

/**
 * Серверный конфиг (приватный, server-only).
 * Здесь допускаются приватные значения и секреты — они никогда не уходят в клиент.
 */
export const ServerConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]),
  appEnv: z.enum(["local", "development", "staging", "production"]).default("local"),
  internalApiBase: z.string().min(1).optional(),
  databaseUrl: z.string().min(1).optional(),
  enableCsp: z.boolean().default(true),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
