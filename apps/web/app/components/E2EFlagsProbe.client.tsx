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
  const [ready, setReady] = useState(false);
  const [betaOn, setBetaOn] = useState(false);
  const [newCheckoutOn, setNewCheckoutOn] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !(navigator as { webdriver?: boolean }).webdriver) {
      return;
    }

    const env = process.env.NEXT_PUBLIC_FLAGS_ENV;
    const percentEnv = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);

    (async () => {
      const overrides = parseOverridesCookie(readCookie("sv_flags_override"));
      const svId = await fetchSvId();

      const betaOverrideKey = "betaUI" as const;
      const beta = Object.prototype.hasOwnProperty.call(overrides, betaOverrideKey)
        ? overrides[betaOverrideKey]
        : env === "dev";

      const percent = Number.isFinite(percentEnv) ? percentEnv : 25;
      const rolloutOverrideKey = "newCheckout" as const;
      const newCheckout = Object.prototype.hasOwnProperty.call(overrides, rolloutOverrideKey)
        ? overrides[rolloutOverrideKey]
        : svId
          ? bucketOfId(svId) < Math.max(0, Math.min(100, percent))
          : false;

      setBetaOn(beta ?? false);
      setNewCheckoutOn(newCheckout ?? false);
      setReady(true);
    })();
  }, []);

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
