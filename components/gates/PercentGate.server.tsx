import type { ReactNode } from "react";

import { getFlagsServerWithMeta } from "../../lib/ff/effective.server";
import { trackExposure } from "../../lib/ff/exposure";
import { FLAG_REGISTRY, type FlagName } from "../../lib/ff/flags";
import { stableId as buildStableId } from "../../lib/ff/stable-id";

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
  const {
    flags,
    sources,
    stableId,
    userId: resolvedUserId,
  } = await getFlagsServerWithMeta({ userId });
  const val = flags[name]; // уже булево после серверного резолва
  if (val) {
    const effectiveUserId = userId ?? resolvedUserId;
    const sid = stableId ?? buildStableId(effectiveUserId);
    trackExposure({
      flag: name,
      value: val,
      source: sources[name] ?? "default",
      stableId: sid,
      userId: effectiveUserId,
    });
  }
  return <>{val ? children : fallback}</>;
}
