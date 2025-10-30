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

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const pattern = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : undefined;
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
    const percentEnv = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);

    (async () => {
      const overrides = parseOverridesCookie(readCookie("sv_flags_override"));
      const context = document.getElementById("e2e-flags-context");
      const hadIncomingSv = context?.getAttribute("data-had-sv") === "1";
      const useEnv = (readCookie("sv_use_env") || "") === "dev";

      const betaOverride = overrides["betaUI"];
      const beta = typeof betaOverride === "boolean" ? betaOverride : useEnv;

      let newCheckout = false;
      const overrideNewCheckout =
        overrides["newcheckout"] ?? overrides["newCheckout"] ?? overrides["new-checkout"];
      if (typeof overrideNewCheckout === "boolean") {
        newCheckout = overrideNewCheckout;
      } else if (hadIncomingSv) {
        const svId = await fetchSvId();
        const percent = Number.isFinite(percentEnv) ? percentEnv : 25;
        newCheckout = svId ? bucketOfId(svId) < Math.max(0, Math.min(100, percent)) : false;
      } else {
        newCheckout = false;
      }

      setBetaOn(Boolean(beta));
      setNewCheckoutOn(Boolean(newCheckout));
      setReady(true);
    })();
  }, [isAutomation]);

  if (!isAutomation) {
    return null;
  }
  if (!ready) {
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
