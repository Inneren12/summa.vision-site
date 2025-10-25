"use client";
import React from "react";

import { FLAG_REGISTRY, type FlagName } from "../../lib/ff/flags";
import { useFlags } from "../FlagsProvider";

import type { FlagKey } from "@/types/flags";

type RolloutName = {
  [K in FlagName]: (typeof FLAG_REGISTRY)[K]["type"] extends "rollout" ? K : never;
}[FlagName];

type RolloutKey = RolloutName & FlagKey;

type Props<N extends RolloutKey = RolloutKey> = {
  name: N;
  /** Fallback используется только если в ENV нет percent (но вычисление делается на сервере в S2-D). */
  fallbackPercent?: number;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export default function PercentGateClient<N extends RolloutKey>({
  name,
  children,
  fallback = null,
}: Props<N>) {
  const flags = useFlags();
  const key = name as FlagName;
  const val = flags[key]; // уже булево после серверного резолва
  return <>{val ? children : fallback}</>;
}
