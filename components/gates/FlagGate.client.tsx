"use client";
import React from "react";

import { FLAG_REGISTRY, type FlagName, type EffectiveValueFor } from "../../lib/ff/flags";
import { useFlags } from "../FlagsProvider";

import type { FlagKey } from "@/types/flags";

type KeyName = FlagKey & FlagName;

type Props<N extends KeyName = KeyName> = {
  name: N;
  equals?: EffectiveValueFor<N>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export default function FlagGate<N extends KeyName>({
  name,
  equals,
  fallback = null,
  children,
}: Props<N>) {
  const flags = useFlags();
  const key = name as FlagName;
  const meta = FLAG_REGISTRY[key];
  const value = flags[key];

  let shouldRender = false;
  if (meta.type === "boolean" || meta.type === "rollout") {
    const expected = (equals as EffectiveValueFor<N> | undefined) ?? true;
    shouldRender = (value as boolean) === expected;
  } else if (meta.type === "string") {
    if (equals === undefined) {
      shouldRender = typeof value === "string" && value.length > 0;
    } else {
      shouldRender = value === equals;
    }
  } else {
    if (equals === undefined) {
      shouldRender = typeof value === "number" ? value !== 0 : Boolean(value);
    } else {
      shouldRender = value === equals;
    }
  }
  return <>{shouldRender ? children : fallback}</>;
}
