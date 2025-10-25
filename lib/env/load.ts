import { EnvSchema, type EnvSchemaShape } from "./schema";

export type Env = {
  NODE_ENV: EnvSchemaShape["NODE_ENV"];
  ADMIN_TOKENS?: string;
  FF_COOKIE_DOMAIN?: string;
  FF_COOKIE_PATH: string;
  FF_COOKIE_SECURE: boolean;
  REDIS_URL?: string;
  ROLLOUT_LOCK_TTL_MS: number;
  METRICS_WINDOW_MS: number;
  NEXT_PUBLIC_DEV_TOOLS: boolean;
};

const DEFAULTS: Pick<
  Env,
  | "FF_COOKIE_PATH"
  | "FF_COOKIE_SECURE"
  | "ROLLOUT_LOCK_TTL_MS"
  | "METRICS_WINDOW_MS"
  | "NEXT_PUBLIC_DEV_TOOLS"
> = {
  FF_COOKIE_PATH: "/",
  FF_COOKIE_SECURE: false,
  ROLLOUT_LOCK_TTL_MS: 15_000,
  METRICS_WINDOW_MS: 1_800_000,
  NEXT_PUBLIC_DEV_TOOLS: false,
};

const REQUIRED_IN_PRODUCTION = [
  "ADMIN_TOKENS",
  "FF_COOKIE_DOMAIN",
  "FF_COOKIE_PATH",
  "FF_COOKIE_SECURE",
] as const satisfies Array<keyof EnvSchemaShape>;

type DefaultKey = keyof typeof DEFAULTS;

let cache: Readonly<Env> | null = null;

function cleanString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function applyDefault<K extends DefaultKey>(
  key: K,
  value: EnvSchemaShape[K],
  defaultsUsed: string[],
): Env[K] {
  if (value === undefined) {
    defaultsUsed.push(key);
    return DEFAULTS[key];
  }
  return value as Env[K];
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Readonly<Env> {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`[env] Invalid environment configuration: ${parsed.error.message}`);
  }

  const raw = parsed.data;
  const defaultsUsed: string[] = [];

  const cleanedStrings: Pick<
    EnvSchemaShape,
    "ADMIN_TOKENS" | "FF_COOKIE_DOMAIN" | "FF_COOKIE_PATH" | "REDIS_URL"
  > = {
    ADMIN_TOKENS: cleanString(raw.ADMIN_TOKENS),
    FF_COOKIE_DOMAIN: cleanString(raw.FF_COOKIE_DOMAIN),
    FF_COOKIE_PATH: cleanString(raw.FF_COOKIE_PATH),
    REDIS_URL: cleanString(raw.REDIS_URL),
  };

  const env: Env = {
    NODE_ENV: raw.NODE_ENV,
    ADMIN_TOKENS: cleanedStrings.ADMIN_TOKENS,
    FF_COOKIE_DOMAIN: cleanedStrings.FF_COOKIE_DOMAIN,
    FF_COOKIE_PATH: applyDefault("FF_COOKIE_PATH", cleanedStrings.FF_COOKIE_PATH, defaultsUsed),
    FF_COOKIE_SECURE: applyDefault("FF_COOKIE_SECURE", raw.FF_COOKIE_SECURE, defaultsUsed),
    REDIS_URL: cleanedStrings.REDIS_URL,
    ROLLOUT_LOCK_TTL_MS: applyDefault("ROLLOUT_LOCK_TTL_MS", raw.ROLLOUT_LOCK_TTL_MS, defaultsUsed),
    METRICS_WINDOW_MS: applyDefault("METRICS_WINDOW_MS", raw.METRICS_WINDOW_MS, defaultsUsed),
    NEXT_PUBLIC_DEV_TOOLS: applyDefault(
      "NEXT_PUBLIC_DEV_TOOLS",
      raw.NEXT_PUBLIC_DEV_TOOLS,
      defaultsUsed,
    ),
  };

  if (defaultsUsed.length > 0) {
    console.info(`[env] Using default environment values: ${defaultsUsed.join(", ")}`);
  }

  const optionalMissing: string[] = [];
  if (!env.REDIS_URL) optionalMissing.push("REDIS_URL");
  if (optionalMissing.length > 0) {
    console.warn(`[env] Missing optional environment variables: ${optionalMissing.join(", ")}`);
  }

  const missingRequired = REQUIRED_IN_PRODUCTION.filter((key) => {
    switch (key) {
      case "ADMIN_TOKENS":
        return !env.ADMIN_TOKENS;
      case "FF_COOKIE_DOMAIN":
        return !env.FF_COOKIE_DOMAIN;
      case "FF_COOKIE_PATH":
        return cleanedStrings.FF_COOKIE_PATH === undefined;
      case "FF_COOKIE_SECURE":
        return raw.FF_COOKIE_SECURE === undefined;
      default:
        return false;
    }
  });

  if (missingRequired.length > 0) {
    const message = `[env] Missing required environment variables: ${missingRequired.join(", ")}`;
    if (env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(message);
  }

  return Object.freeze(env);
}

export function getEnv(): Readonly<Env> {
  if (!cache) {
    cache = loadEnv();
  }
  return cache;
}

export function __resetEnvCache() {
  cache = null;
}
