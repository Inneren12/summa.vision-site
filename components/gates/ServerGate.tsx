import type { ReactNode } from "react";

import { getFlag } from "../../lib/ff/server";

import type { FlagKey } from "@/types/flags";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  requireFlag?: FlagKey;
  equals?: string | number | boolean;
};

export default async function ServerGate({
  children,
  fallback = null,
  requireFlag,
  equals = true,
}: Props) {
  if (requireFlag) {
    const value = await getFlag(requireFlag);
    if (value !== (equals ?? true)) return <>{fallback}</>;
  }
  return <>{children}</>;
}
