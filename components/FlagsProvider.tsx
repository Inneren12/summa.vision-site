"use client";

import React, { createContext, useContext } from "react";

import type { EffectiveFlags } from "../lib/ff/flags";

const FlagsContext = createContext<EffectiveFlags | null>(null);

export default function FlagsProvider({
  serverFlags,
  children,
}: {
  serverFlags: EffectiveFlags;
  children: React.ReactNode;
}) {
  return <FlagsContext.Provider value={serverFlags}>{children}</FlagsContext.Provider>;
}

export function useFlags(): Readonly<EffectiveFlags> {
  const ctx = useContext(FlagsContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("useFlags() must be used within <FlagsProvider>");
    }
    // в проде — безопасный fallback (пустые значения)
    return {} as EffectiveFlags;
  }
  return ctx;
}
