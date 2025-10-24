import type { ReactNode } from "react";

import { getFlagsServer } from "@/lib/ff/effective.server";
import { FLAG_REGISTRY, type FlagName } from "@/lib/ff/flags";

type VariantFlagName = {
  [K in FlagName]: (typeof FLAG_REGISTRY)[K]["type"] extends "variant" ? K : never;
}[FlagName];

type Props<N extends VariantFlagName = VariantFlagName> = {
  name: N;
  variant: string;
  fallback?: ReactNode;
  children: ReactNode;
  userId?: string;
};

export default async function VariantGateServer<N extends VariantFlagName>({
  name,
  variant,
  fallback = null,
  children,
  userId,
}: Props<N>) {
  const flags = await getFlagsServer({ userId });
  const val = flags[name];
  const should = typeof val === "string" ? val === variant : false;
  return <>{should ? children : fallback}</>;
}
