import FlagsProvider from "@/components/FlagsProvider";
import FlagGateServer from "@/components/gates/FlagGate.server";
import PercentGateServer from "@/components/gates/PercentGate.server";
import { getFlagsServer } from "@/lib/ff/effective.server";
import { withExposureContext } from "@/lib/ff/exposure";
import { sanitizeUserId, stableId } from "@/lib/ff/stable-id";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const userId = typeof searchParams?.user === "string" ? searchParams!.user : undefined;
  const sid = stableId();
  const sanitizedUserId = userId ? sanitizeUserId(userId) : undefined;
  return withExposureContext(async () => (
    <main style={{ padding: 16 }}>
      <h1>S3-B StableId Test</h1>
      <p>
        <strong>userId</strong>: {sanitizedUserId ?? userId ?? "(none)"} | <strong>stableId</strong>
        : {sid}
      </p>
      <p>
        Try <code>?user=123</code> and reload with different cookies.
      </p>
      <FlagsProvider serverFlags={await getFlagsServer({ userId })}>
        <section data-testid="ssr">
          <FlagGateServer name="betaUI" userId={userId}>
            <div data-testid="beta-ssr">SSR-BETA-ON</div>
          </FlagGateServer>
          <PercentGateServer name="newCheckout" userId={userId}>
            <div data-testid="nc-ssr">SSR-NC-ON</div>
          </PercentGateServer>
        </section>
      </FlagsProvider>
    </main>
  ));
}
