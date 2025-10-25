import { notFound } from "next/navigation";

import FlagGateServer from "@/components/gates/FlagGate.server";
import { getEnv } from "@/lib/env/load";
import { withExposureContext } from "@/lib/ff/exposure";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    notFound();
  }
  return withExposureContext(async () => (
    <main style={{ padding: 16 }}>
      <h1>Exposure Test</h1>
      {/* Три одинаковых гейта — должно дать ровно 1 exposure на SSR */}
      <FlagGateServer name="betaUI">
        <div data-testid="exp-a">A</div>
      </FlagGateServer>
      <FlagGateServer name="betaUI">
        <div data-testid="exp-b">B</div>
      </FlagGateServer>
      <FlagGateServer name="betaUI">
        <div data-testid="exp-c">C</div>
      </FlagGateServer>
    </main>
  ));
}
