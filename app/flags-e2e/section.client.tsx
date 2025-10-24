"use client";

import { useFlags } from "../../components/FlagsProvider";

export default function ClientSection() {
  const flags = useFlags();
  return (
    <section data-testid="csr-section">
      {flags.betaUI && <div data-testid="beta-csr-on">CSR-BETA-ON</div>}
      {flags.newCheckout && <div data-testid="newcheckout-csr-on">CSR-NC-ON</div>}
    </section>
  );
}
