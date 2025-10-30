import dynamicImport from "next/dynamic";
import { headers } from "next/headers";

import { gatePercent, parseOverridesCookie } from "@/lib/flags/eval";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function fromRawCookie(raw: string, name: string): string | null {
  if (!raw) {
    return null;
  }
  const escaped = name.replace(/[\\^$*+?.()|[\]{}-]/g, "\\$&");
  const match = raw.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const ClientProbe = dynamicImport(() => import("../components/E2EFlagsProbe.client"), {
  ssr: false,
});

export default function FlagsE2EPage() {
  const raw = headers().get("cookie") || "";
  const incomingId = fromRawCookie(raw, "sv_id") || "";
  const hadIncoming = incomingId.length > 0;
  const overrides = parseOverridesCookie(fromRawCookie(raw, "sv_flags_override") || "");
  const useEnvDev = (fromRawCookie(raw, "sv_use_env") || "") === "dev";

  const betaOverride = overrides.betaUI;
  const betaSSR = typeof betaOverride === "boolean" ? betaOverride : useEnvDev;

  const pctRaw = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
  const percent = Number.isFinite(pctRaw) ? pctRaw : 25;
  const overrideNewCheckout =
    overrides.newcheckout ?? overrides.newCheckout ?? overrides["new-checkout"];
  const newCheckoutSSR =
    typeof overrideNewCheckout === "boolean"
      ? overrideNewCheckout
      : useEnvDev
        ? true
        : hadIncoming
          ? gatePercent({ overrides, id: incomingId, percent })
          : false;

  return (
    <main className="space-y-3 p-6">
      <div
        id="e2e-flags-context"
        data-had-sv={hadIncoming ? "1" : "0"}
        style={{ display: "none" }}
      />
      <div data-testid={betaSSR ? "beta-ssr-on" : "beta-ssr-off"}>
        {betaSSR ? "beta ssr on" : "beta ssr off"}
      </div>
      <div data-testid={newCheckoutSSR ? "newcheckout-ssr-on" : "newcheckout-ssr-off"}>
        {newCheckoutSSR ? "newcheckout ssr on" : "newcheckout ssr off"}
      </div>
      <ClientProbe />
    </main>
  );
}
