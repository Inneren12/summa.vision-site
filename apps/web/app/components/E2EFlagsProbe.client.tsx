"use client";

import { useEffect, useState } from "react";

import { bucketOfId, parseOverridesCookie } from "@/lib/flags/eval";

async function fetchSvId(): Promise<string> {
  try {
    const response = await fetch("/api/dev/sv-id", { cache: "no-store" });
    if (!response.ok) {
      return "";
    }
    const data = (await response.json()) as { id?: string };
    return typeof data?.id === "string" ? data.id : "";
  } catch {
    return "";
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const pattern = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function E2EFlagsProbeClient() {
  const isAutomation =
    typeof navigator !== "undefined" && Boolean((navigator as { webdriver?: boolean }).webdriver);

  const [ready, setReady] = useState(false);
  const [betaOn, setBetaOn] = useState(false);
  const [newCheckoutOn, setNewCheckoutOn] = useState(false);

  useEffect(() => {
    if (!isAutomation) {
      return;
    }

    (async () => {
      const overrides = parseOverridesCookie(readCookie("sv_flags_override") || undefined);
      const context = document.getElementById("e2e-flags-context");
      const hadIncomingSv = context?.getAttribute("data-had-sv") === "1";
      const useEnvDev = (readCookie("sv_use_env") || "") === "dev";

      const betaOverride = overrides.betaUI;
      const betaValue = typeof betaOverride === "boolean" ? betaOverride : useEnvDev;

      const percentEnv = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
      const percent = Number.isFinite(percentEnv) ? percentEnv : 25;
      const overrideNewCheckout =
        overrides.newcheckout ?? overrides.newCheckout ?? overrides["new-checkout"];
      let newCheckoutValue = false;
      if (typeof overrideNewCheckout === "boolean") {
        newCheckoutValue = overrideNewCheckout;
      } else if (useEnvDev) {
        newCheckoutValue = true;
      } else if (hadIncomingSv) {
        const svId = readCookie("sv_id") || (await fetchSvId());
        newCheckoutValue = svId ? bucketOfId(svId) < Math.max(0, Math.min(100, percent)) : false;
      }

      setBetaOn(Boolean(betaValue));
      setNewCheckoutOn(Boolean(newCheckoutValue));
      setReady(true);
    })();
  }, [isAutomation]);

  if (!isAutomation || !ready) {
    return null;
  }

  return (
    <>
      <div data-testid={betaOn ? "beta-csr-on" : "beta-csr-off"}>
        {betaOn ? "beta csr on" : "beta csr off"}
      </div>
      <div data-testid={newCheckoutOn ? "newcheckout-csr-on" : "newcheckout-csr-off"}>
        {newCheckoutOn ? "newcheckout csr on" : "newcheckout csr off"}
      </div>
    </>
  );
}
