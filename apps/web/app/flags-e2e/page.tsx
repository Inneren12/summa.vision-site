import nextDynamic from "next/dynamic";
import { headers } from "next/headers";

import { gatePercent, parseOverridesCookie } from "@/lib/flags/eval";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function fromCookie(raw: string, name: string): string | null {
  if (!raw) {
    return null;
  }
  const escaped = name.replace(/[\\^$*+?.()|[\]{}-]/g, "\\$&");
  const match = raw.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const ClientProbe = nextDynamic(() => import("../components/E2EFlagsProbe.client"), {
  ssr: false,
});

export default function FlagsE2EPage() {
  const raw = headers().get("cookie") || "";

  const incomingId = fromCookie(raw, "sv_id") || "";
  const hadIncoming = incomingId.length > 0;
  const overrides = parseOverridesCookie(fromCookie(raw, "sv_flags_override") || undefined);
  // На /flags-e2e запрещаем опираться на сборочное ENV — только cookie-тумблер управляет "dev"
  const useEnvDev = (fromCookie(raw, "sv_use_env") || "") === "dev";

  const betaSSR = typeof overrides.betaUI === "boolean" ? overrides.betaUI : useEnvDev;

  const pctRaw = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
  const percent = Number.isFinite(pctRaw) ? pctRaw : 25;
  const newCheckoutSSR =
    typeof overrides.newcheckout === "boolean"
      ? overrides.newcheckout
      : useEnvDev
        ? true
        : hadIncoming
          ? gatePercent({ overrides, id: incomingId, percent })
          : false;

  return (
    <main className="space-y-2 p-6">
      <div
        id="e2e-flags-context"
        data-had-sv={hadIncoming ? "1" : "0"}
        style={{ display: "none" }}
      />
      <div data-testid={betaSSR ? "beta-ssr-on" : "beta-ssr-off"} />
      <div data-testid={newCheckoutSSR ? "newcheckout-ssr-on" : "newcheckout-ssr-off"} />
      <ClientProbe />
    </main>
  );
}
