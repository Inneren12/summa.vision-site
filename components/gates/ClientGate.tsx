"use client";

import type { ReactNode } from "react";
import React from "react";

import { useFlag } from "../../lib/ff/client";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Render children only if requireFlag === equals (default equals=true for boolean flags) */
  requireFlag?: string;
  equals?: string | number | boolean;
};

export default function ClientGate({
  children,
  fallback = null,
  requireFlag,
  equals = true,
}: Props) {
  const flagValue = useFlag(requireFlag);
  const okByFlag = requireFlag ? flagValue === (equals ?? true) : true;

  // avoid initial CSR flicker until mounted
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback}</>;
  if (!okByFlag) return <>{fallback}</>;
  return <>{children}</>;
}
