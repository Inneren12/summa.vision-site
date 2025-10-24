"use client";

import { useMemo } from "react";

import { getClientEnv } from "../env.client";

import { readOverridesFromCookieHeader } from "./overrides";
import { parseFlagsJson, mergeFlags, type FeatureFlags, type FlagValue } from "./shared";

export function getFeatureFlags(): FeatureFlags {
  const env = getClientEnv();
  const envFlags = parseFlagsJson(env.NEXT_PUBLIC_FEATURE_FLAGS_JSON);
  let cookieHeader: string | undefined;
  if (typeof document !== "undefined" && typeof document.cookie === "string") {
    cookieHeader = document.cookie;
  }
  const overrides = readOverridesFromCookieHeader(cookieHeader);
  return mergeFlags(envFlags, overrides);
}

export function getFlag<T extends FlagValue = boolean>(name: string, fallback?: T): T | undefined {
  const flags = getFeatureFlags();
  const value = flags[name];
  return (value as T | undefined) ?? fallback;
}

export function useFlag<T extends FlagValue = boolean>(
  name: string | undefined,
  fallback?: T,
): T | undefined {
  return useMemo(() => {
    if (!name) return fallback;
    return getFlag<T>(name, fallback);
  }, [name, fallback]);
}
