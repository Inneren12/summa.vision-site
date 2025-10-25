import { createElement, type ReactNode } from "react";

import FlagGate from "./FlagGate";
import { shouldRenderFlag } from "./flag-evaluate";

import { getFlagsServerWithMeta } from "@/lib/ff/effective.server";
import { trackExposure } from "@/lib/ff/exposure";
import { type FlagName, type EffectiveValueFor } from "@/lib/ff/flags";
import { stableId as buildStableId } from "@/lib/ff/stable-id";
import type { FlagKey } from "@/types/flags";

type KeyName = FlagKey & FlagName;

type Props<N extends KeyName = KeyName> = {
  name: N;
  equals?: EffectiveValueFor<N>;
  fallback?: ReactNode;
  skeleton?: ReactNode;
  children: ReactNode;
  /** Опционально: принудительно использовать userId как stableId для кросс-девайс консистентности. */
  userId?: string;
};

export default async function FlagGateServer<N extends KeyName>({
  name,
  equals,
  fallback = null,
  skeleton,
  children,
  userId,
}: Props<N>) {
  const {
    flags,
    sources,
    stableId,
    userId: resolvedUserId,
  } = await getFlagsServerWithMeta({ userId });
  const key = name as FlagName;
  const value = flags[key];
  const source = sources[key] ?? "default";
  const shouldRender = shouldRenderFlag({
    key,
    value: value as EffectiveValueFor<N> | undefined,
    equals,
  });

  if (shouldRender) {
    const effectiveUserId = userId ?? resolvedUserId;
    const sid = stableId ?? buildStableId();
    trackExposure({
      flag: key,
      value: value as EffectiveValueFor<N>,
      source,
      stableId: sid,
      userId: effectiveUserId,
    });
  }

  return createElement(
    FlagGate,
    {
      name,
      equals,
      fallback,
      skeleton,
      ssr: { shouldRender },
    },
    children,
  );
}
