"use client";

import { useEffect, useState } from "react";

import { bucketOfId, parseOverridesCookie } from "@/lib/flags/eval";

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

    const overrides = parseOverridesCookie(readCookie("sv_flags_override") || undefined);
    const context = document.getElementById("e2e-flags-context");
    const hadIncomingSv = context?.getAttribute("data-had-sv") === "1";
    const useEnvDev =
      (process.env.NEXT_PUBLIC_FLAGS_ENV || "").toLowerCase() === "dev" ||
      (readCookie("sv_use_env") || "") === "dev";

    const betaOverride = overrides.betaUI;
    const betaValue = typeof betaOverride === "boolean" ? betaOverride : useEnvDev;

    const percentEnv = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
    const percent = Number.isFinite(percentEnv) ? percentEnv : 25;

    let newCheckoutValue = false;
    if (typeof overrides.newcheckout === "boolean") {
      newCheckoutValue = overrides.newcheckout;
    } else if (useEnvDev) {
      newCheckoutValue = true;
    } else if (hadIncomingSv) {
      const svId = readCookie("sv_id") || "";
      newCheckoutValue = svId ? bucketOfId(svId) < Math.max(0, Math.min(100, percent)) : false;
    }

    setBetaOn(Boolean(betaValue));
    setNewCheckoutOn(Boolean(newCheckoutValue));
    setReady(true);
  }, [isAutomation]);

  if (!isAutomation || !ready) {
    return null;
  }

  return (
    <>
      <div data-testid={betaOn ? "beta-csr-on" : "beta-csr-off"} />
      <div data-testid={newCheckoutOn ? "newcheckout-csr-on" : "newcheckout-csr-off"} />
    </>
  );
}
