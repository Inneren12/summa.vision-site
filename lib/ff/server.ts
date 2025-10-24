import "server-only";
import path from "node:path";

import { getServerEnv } from "../env.server";
import { isEdgeRuntime, assertServer } from "../runtime-guards";

import { readOverridesFromCookieHeader, type Overrides } from "./overrides";
import { parseFlagsJson, mergeFlags, type FeatureFlags, type FlagValue } from "./shared";

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

/** Server-side flags: dev-local (dev+Node) -> ENV(JSON) -> overrides(cookie). Later ones win. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  assertServer("getFeatureFlags (server)");
  const env = getServerEnv();

  // dev-local file only if not production AND not Edge runtime
  let localFlags: FeatureFlags = {};
  if (env.NODE_ENV !== "production" && !isEdgeRuntime()) {
    const localPath = process.env.FEATURE_FLAGS_LOCAL_PATH || DEFAULT_LOCAL_PATH;
    localFlags = await readLocalFlagsFile(localPath);
  }

  const envFlags = parseFlagsJson(env.FEATURE_FLAGS_JSON);
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

export async function getFeatureFlagsFromHeaders(
  h?: Headers | Record<string, string>,
): Promise<FeatureFlags> {
  assertServer("getFeatureFlagsFromHeaders");
  const base = await getFeatureFlags();
  let cookieHeader: string | undefined;
  if (isHeadersLike(h)) {
    cookieHeader = h.get("cookie") ?? undefined;
  } else if (hasCookieString(h)) {
    cookieHeader = h.cookie;
  }
  const overrides: Overrides = readOverridesFromCookieHeader(cookieHeader);
  return mergeFlags(base, overrides);
}
