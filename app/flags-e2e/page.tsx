import FlagGateServer from "../../components/gates/FlagGate.server";
import PercentGateServer from "../../components/gates/PercentGate.server";

import ClientSection from "./section.client";

export const dynamic = "force-dynamic";

export default async function FlagsE2ePage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>E2E Flags Testbed</h1>
      <section data-testid="ssr-section">
        <FlagGateServer name="betaUI">
          <div data-testid="beta-ssr-on">SSR-BETA-ON</div>
        </FlagGateServer>

        <PercentGateServer name="newCheckout">
          <div data-testid="newcheckout-ssr-on">SSR-NC-ON</div>
        </PercentGateServer>
      </section>
      <ClientSection />
    </main>
  );
}
