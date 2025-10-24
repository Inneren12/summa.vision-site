import type { ReactNode } from "react";

import FlagsProvider from "../../components/FlagsProvider";
import { getUserIdServer } from "../../lib/auth/user";
import { getFlagsServer } from "../../lib/ff/effective.server";
import { withExposureContext } from "../../lib/ff/exposure";

export const dynamic = "force-dynamic";

export default async function FlagsE2eLayout({ children }: { children: ReactNode }) {
  return withExposureContext(async () => {
    const userId = getUserIdServer();
    const flags = await getFlagsServer({ userId });
    return <FlagsProvider serverFlags={flags}>{children}</FlagsProvider>;
  });
}
