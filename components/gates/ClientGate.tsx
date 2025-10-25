"use client";

import type { ReactNode } from "react";
import React from "react";

import { useOptionalFlag } from "../../lib/ff/client";

import type { FlagKey } from "@/types/flags";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Render children only if requireFlag === equals (default equals=true for boolean flags) */
  requireFlag?: FlagKey;
  equals?: string | number | boolean;
};

export default function ClientGate({
  children,
  fallback = null,
  requireFlag,
  equals = true,
}: Props) {
  const flagValue = useOptionalFlag(requireFlag);
  const okByFlag = requireFlag ? flagValue === (equals ?? true) : true;

  // avoid initial CSR flicker until mounted
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback}</>;
  if (!okByFlag) return <>{fallback}</>;
  return <>{children}</>;
}
