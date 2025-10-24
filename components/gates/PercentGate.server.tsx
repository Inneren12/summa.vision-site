import type { ReactNode } from "react";

import { getFlagsServer } from "../../lib/ff/effective.server";

type Props = {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export default async function PercentGateServer({ name, children, fallback = null }: Props) {
  const flags = await getFlagsServer();
  const value = flags[name];
  if (typeof value === "boolean") {
    return value ? <>{children}</> : <>{fallback}</>;
  }
  return <>{fallback}</>;
}
