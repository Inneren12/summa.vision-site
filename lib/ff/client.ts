"use client";

import { useMemo } from "react";

import { getClientEnv } from "../env.client";

import { readOverridesFromCookieHeader } from "./overrides";
import { parseFlagsJson, mergeFlags, type FeatureFlags, type FlagValue } from "./shared";

import { useFlags } from "@/components/FlagsProvider";
import type { GeneratedFlagTypeMap, GeneratedFlagName } from "@/types/flags.generated";

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

export function useFlagValue<T extends FlagValue = boolean>(
  name: string | undefined,
  fallback?: T,
): T | undefined {
  return useMemo(() => {
    if (!name) return fallback;
    return getFlag<T>(name, fallback);
  }, [name, fallback]);
}

/** useFlag с жёсткой типизацией возвращаемого значения по имени флага. */
export function useFlag<N extends GeneratedFlagName>(name: N): GeneratedFlagTypeMap[N] {
  const flags = useFlags() as Record<string, unknown>;
  return flags[name] as GeneratedFlagTypeMap[N];
}

/** Получить значение флага, если имя известно; иначе вернуть undefined. */
export function useOptionalFlag<N extends GeneratedFlagName>(
  name: N | undefined,
): GeneratedFlagTypeMap[N] | undefined {
  const flags = useFlags() as Record<string, unknown>;
  if (!name) return undefined;
  return flags[name] as GeneratedFlagTypeMap[N];
}
