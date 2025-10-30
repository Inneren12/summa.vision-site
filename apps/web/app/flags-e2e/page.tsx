import dynamicImport from "next/dynamic";
import { cookies } from "next/headers";

import { gateBoolean, gatePercent, parseOverridesCookie } from "@/lib/flags/eval";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const E2EFlagsProbeClient = dynamicImport(() => import("../components/E2EFlagsProbe.client"), {
  ssr: false,
});

export default function FlagsE2EPage() {
  const jar = cookies();
  const svId = jar.get("sv_id")?.value ?? "";
  const overrides = parseOverridesCookie(jar.get("sv_flags_override")?.value);
  const env = process.env.NEXT_PUBLIC_FLAGS_ENV;
  const pct = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);

  const betaSSR = gateBoolean({ name: "betaUI", overrides, env, envDefault: true });
  const newCheckoutSSR = gatePercent({
    name: "newCheckout",
    overrides,
    id: svId,
    percent: Number.isFinite(pct) ? pct : 25,
    env,
  });

  return (
    <main className="space-y-3 p-6">
      <div data-testid={betaSSR ? "beta-ssr-on" : "beta-ssr-off"}>
        {betaSSR ? "beta ssr on" : "beta ssr off"}
      </div>
      <div data-testid={newCheckoutSSR ? "newcheckout-ssr-on" : "newcheckout-ssr-off"}>
        {newCheckoutSSR ? "newcheckout ssr on" : "newcheckout ssr off"}
      </div>
      <E2EFlagsProbeClient />
    </main>
  );
}
