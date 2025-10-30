import dynamicImport from "next/dynamic";
import { cookies } from "next/headers";

import { bucketOfId, parseOverridesCookie } from "@/lib/flags/eval";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const E2EFlagsProbeClient = dynamicImport(() => import("../components/E2EFlagsProbe.client"), {
  ssr: false,
});

export default function FlagsE2EPage() {
  const jar = cookies();
  const overrides = parseOverridesCookie(jar.get("sv_flags_override")?.value);
  const incomingSvId = jar.get("sv_id")?.value ?? "";
  const hadIncomingSv = incomingSvId.length > 0;

  const betaOverride = overrides["betaUI"];
  const betaSSR = typeof betaOverride === "boolean" ? betaOverride : false;

  const pct = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
  const percent = Number.isFinite(pct) ? pct : 25;
  const overrideNewCheckout =
    overrides["newcheckout"] ?? overrides["newCheckout"] ?? overrides["new-checkout"];
  const newCheckoutSSR =
    typeof overrideNewCheckout === "boolean"
      ? overrideNewCheckout
      : hadIncomingSv
        ? bucketOfId(incomingSvId) < Math.max(0, Math.min(100, percent))
        : false;

  return (
    <main className="space-y-3 p-6">
      <div
        id="e2e-flags-context"
        data-had-sv={hadIncomingSv ? "1" : "0"}
        style={{ display: "none" }}
      />
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
