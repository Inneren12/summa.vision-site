import type { ReactNode } from "react";

import FlagsProvider from "../../components/FlagsProvider";
import { getFlagsServer } from "../../lib/ff/effective.server";

export const dynamic = "force-dynamic";

export default async function FlagsE2eLayout({ children }: { children: ReactNode }) {
  const flags = await getFlagsServer();
  return <FlagsProvider serverFlags={flags}>{children}</FlagsProvider>;
}
