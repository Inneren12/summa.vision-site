import type { ReactNode } from "react";

import { getFlag } from "../../lib/ff/server";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  requireFlag?: string;
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
