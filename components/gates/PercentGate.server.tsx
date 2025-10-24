import type { ReactNode } from "react";

import { getFlagsServer } from "../../lib/ff/effective.server";
import { FLAG_REGISTRY, type FlagName } from "../../lib/ff/flags";

type RolloutName = {
  [K in FlagName]: (typeof FLAG_REGISTRY)[K]["type"] extends "rollout" ? K : never;
}[FlagName];

type Props<N extends RolloutName = RolloutName> = {
  name: N;
  fallbackPercent?: number; // используется только как ENV-fallback в будущем; вычисление уже на сервере
  fallback?: ReactNode;
  children: ReactNode;
  /** Опционально: принудительно использовать userId как stableId. */
  userId?: string;
};

export default async function PercentGateServer<N extends RolloutName>({
  name,
  children,
  fallback = null,
  userId,
}: Props<N>) {
  const flags = await getFlagsServer({ userId });
  const val = flags[name]; // уже булево после серверного резолва
  return <>{val ? children : fallback}</>;
}
