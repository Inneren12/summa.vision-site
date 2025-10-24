"use client";
import React from "react";

import { FLAG_REGISTRY, type FlagName } from "../../lib/ff/flags";
import { useFlags } from "../FlagsProvider";

type RolloutName = {
  [K in FlagName]: (typeof FLAG_REGISTRY)[K]["type"] extends "rollout" ? K : never;
}[FlagName];

type Props<N extends RolloutName = RolloutName> = {
  name: N;
  /** Fallback используется только если в ENV нет percent (но вычисление делается на сервере в S2-D). */
  fallbackPercent?: number;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export default function PercentGateClient<N extends RolloutName>({
  name,
  children,
  fallback = null,
}: Props<N>) {
  const flags = useFlags();
  const val = flags[name]; // уже булево после серверного резолва
  return <>{val ? children : fallback}</>;
}
