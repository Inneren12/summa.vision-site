import type { ReactNode } from "react";

import { getFlagsServerWithMeta } from "@/lib/ff/effective.server";
import { trackExposure } from "@/lib/ff/exposure";
import { FLAG_REGISTRY, type FlagName } from "@/lib/ff/flags";
import { stableId as buildStableId } from "@/lib/ff/stable-id";
import type { FlagKey } from "@/types/flags";

type VariantFlagName = {
  [K in FlagName]: (typeof FLAG_REGISTRY)[K]["type"] extends "variant" ? K : never;
}[FlagName];

type VariantFlagKey = VariantFlagName & FlagKey;

type Props<N extends VariantFlagKey = VariantFlagKey> = {
  name: N;
  variant: string;
  fallback?: ReactNode;
  children: ReactNode;
  userId?: string;
};

export default async function VariantGateServer<N extends VariantFlagKey>({
  name,
  variant,
  fallback = null,
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
  const val = flags[key];
  const should = typeof val === "string" ? val === variant : false;
  if (should) {
    const effectiveUserId = userId ?? resolvedUserId;
    const sid = stableId ?? buildStableId();
    trackExposure({
      flag: key,
      value: val,
      source: sources[key] ?? "default",
      stableId: sid,
      userId: effectiveUserId,
    });
  }
  return <>{should ? children : fallback}</>;
}
