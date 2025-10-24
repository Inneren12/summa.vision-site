"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { getFeatureFlags as getClientFlags } from "../lib/ff/client";
import type { EffectiveFlags } from "../lib/ff/effective.shared";
import { computeEffectiveFlags } from "../lib/ff/effective.shared";
import { getStableIdFromCookieHeader } from "../lib/ff/stable-id";

const FlagsContext = createContext<EffectiveFlags | null>(null);

type Props = {
  serverFlags?: EffectiveFlags;
  children: ReactNode;
};

function getClientEffectiveFlags(): EffectiveFlags {
  const raw = getClientFlags();
  const stableId = getStableIdFromCookieHeader(
    typeof document !== "undefined" ? document.cookie : undefined,
  );
  return computeEffectiveFlags(raw, stableId);
}

export default function FlagsProvider({ serverFlags, children }: Props) {
  const value = useMemo(() => {
    const clientFlags = getClientEffectiveFlags();
    return { ...serverFlags, ...clientFlags };
  }, [serverFlags]);

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): EffectiveFlags {
  const ctx = useContext(FlagsContext);
  if (ctx) return ctx;
  return getClientEffectiveFlags();
}

export function useFlag(name: string): boolean | number | string | undefined {
  const flags = useFlags();
  return flags[name];
}
