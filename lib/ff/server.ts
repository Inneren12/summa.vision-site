import "server-only";
import path from "node:path";

import { getServerEnv, __resetServerEnvCacheForTests } from "../env.server";
import { isEdgeRuntime, assertServer } from "../runtime-guards";

import { isKnownFlag, FLAG_REGISTRY, type FlagName } from "./flags";
import { readGlobals } from "./global";
import { readOverridesFromCookieHeader, type Overrides } from "./overrides";
import { perfInc } from "./perf";
import { devWarnFeatureFlagsSchemaOnce } from "./schema";
import { parseFlagsJson, mergeFlags, type FeatureFlags, type FlagValue } from "./shared";
import type { TelemetrySource } from "./telemetry";

const DEFAULT_LOCAL_PATH = path.join(process.cwd(), "config", "feature-flags.local.json");

async function readLocalFlagsFile(filePath: string): Promise<FeatureFlags> {
  const { readFile } = await import("node:fs/promises");
  try {
    const json = await readFile(filePath, "utf8");
    return parseFlagsJson(json);
  } catch {
    return {};
  }
}

let __envCacheSig = "";
let __envCacheParsed: FeatureFlags = {} as FeatureFlags;

function envSignature(str: string | undefined | null): string {
  if (!str) return "0:";
  return String(str.length) + ":" + str.slice(0, 32);
}

/** Server-side flags: dev-local (dev+Node) -> ENV(JSON) -> overrides(cookie). Later ones win. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  assertServer("getFeatureFlags (server)");
  devWarnFeatureFlagsSchemaOnce();
  const env = getServerEnv();

  // dev-local file only if not production AND not Edge runtime
  let localFlags: FeatureFlags = {};
  if (env.NODE_ENV !== "production" && !isEdgeRuntime()) {
    const localPath = process.env.FEATURE_FLAGS_LOCAL_PATH || DEFAULT_LOCAL_PATH;
    localFlags = await readLocalFlagsFile(localPath);
  }

  const raw = env.FEATURE_FLAGS_JSON;
  const sig = envSignature(raw);
  if (sig !== __envCacheSig) {
    perfInc("ff.env.parse");
    const parsed = parseFlagsJson(raw);
    __envCacheParsed = parsed;
    __envCacheSig = sig;
  }
  const envFlags = __envCacheParsed;
  return mergeFlags(localFlags, envFlags);
}

export async function getFlag<T extends FlagValue = boolean>(
  name: string,
  fallback?: T,
): Promise<T | undefined> {
  const flags = await getFeatureFlags();
  const value = flags[name];
  return (value as T | undefined) ?? fallback;
}

/** Merge overrides from provided headers object (e.g., Route Handler) */
function isHeadersLike(value: unknown): value is Headers {
  return (
    typeof value === "object" && value !== null && typeof (value as Headers).get === "function"
  );
}

function hasCookieString(value: unknown): value is { cookie: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { cookie?: unknown }).cookie === "string"
  );
}

export type FlagSources = Record<FlagName, TelemetrySource>;

export async function getFeatureFlagsFromHeadersWithSources(
  h?: Headers | Record<string, string>,
): Promise<{ merged: FeatureFlags; sources: FlagSources }> {
  assertServer("getFeatureFlagsFromHeadersWithSources");
  const base = await getFeatureFlags();
  let cookieHeader: string | undefined;
  if (isHeadersLike(h)) {
    cookieHeader = h.get("cookie") ?? undefined;
  } else if (hasCookieString(h)) {
    cookieHeader = h.cookie;
  }
  const overrides: Overrides = readOverridesFromCookieHeader(cookieHeader);
  const filtered = Object.fromEntries(
    Object.entries(overrides).filter(([name]) => {
      if (!isKnownFlag(name)) return true;
      const definition = FLAG_REGISTRY[name];
      return !("ignoreOverrides" in definition && definition.ignoreOverrides === true);
    }),
  );
  const globals = readGlobals();
  const merged = mergeFlags(mergeFlags(base, filtered), globals);
  const sources = {} as FlagSources;
  for (const name of Object.keys(FLAG_REGISTRY) as FlagName[]) {
    if (Object.prototype.hasOwnProperty.call(globals, name)) {
      sources[name] = "global";
    } else if (Object.prototype.hasOwnProperty.call(filtered, name)) {
      sources[name] = "override";
    } else if (Object.prototype.hasOwnProperty.call(base, name)) {
      sources[name] = "env";
    } else {
      sources[name] = "default";
    }
  }
  return { merged, sources };
}

export async function getFeatureFlagsFromHeaders(
  h?: Headers | Record<string, string>,
): Promise<FeatureFlags> {
  const { merged } = await getFeatureFlagsFromHeadersWithSources(h);
  return merged;
}

export function __devSetFeatureFlagsJson(next: string) {
  if (process.env.NODE_ENV === "production") return;
  process.env.FEATURE_FLAGS_JSON = next;
  __resetServerEnvCacheForTests();
}

/** Для dev-роута и тестов: сбросить кэш ENV-парсинга. */
export function __resetEnvCache() {
  __envCacheSig = "";
  __envCacheParsed = {} as FeatureFlags;
}

export function __resetFeatureFlagsCacheForTests() {
  __resetServerEnvCacheForTests();
  __resetEnvCache();
}
