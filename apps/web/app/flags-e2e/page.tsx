import dynamicImport from "next/dynamic";
import { headers } from "next/headers";

import { gatePercent, parseOverridesCookie } from "@/lib/flags/eval";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function readCookieFromHeader(raw: string, name: string): string | null {
  if (!raw) return null;
  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const match = raw.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const E2EFlagsProbeClient = dynamicImport(() => import("../components/E2EFlagsProbe.client"), {
  ssr: false,
});

export default function FlagsE2EPage() {
  const rawCookie = headers().get("cookie") || "";

  const incomingSvId = readCookieFromHeader(rawCookie, "sv_id") ?? "";
  const hadIncomingSv = incomingSvId.length > 0;
  const overrides = parseOverridesCookie(
    readCookieFromHeader(rawCookie, "sv_flags_override") ?? "",
  );

  const envDev =
    (process.env.NEXT_PUBLIC_FLAGS_ENV || "").toLowerCase() === "dev" ||
    (readCookieFromHeader(rawCookie, "sv_use_env") ?? "") === "dev";

  const betaOverride = overrides.betaUI;
  const betaSSR = typeof betaOverride === "boolean" ? betaOverride : envDev;

  const pct = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
  const percent = Number.isFinite(pct) ? pct : 25;
  const overrideNewCheckout =
    overrides.newcheckout ?? overrides.newCheckout ?? overrides["new-checkout"];
  const newCheckoutSSR =
    typeof overrideNewCheckout === "boolean"
      ? overrideNewCheckout
      : envDev
        ? true
        : hadIncomingSv
          ? gatePercent({
              name: "newcheckout",
              overrides,
              id: incomingSvId,
              percent,
            })
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
