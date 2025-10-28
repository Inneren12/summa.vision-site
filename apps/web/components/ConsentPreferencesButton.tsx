"use client";

import { useCallback, useState } from "react";

const TEST_ENV = typeof process !== "undefined" && process.env.NODE_ENV === "test";

export function ConsentPreferencesButton() {
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(() => {
    if (pending) {
      return;
    }
    setPending(true);
    if (TEST_ENV) {
      setPending(false);
      return;
    }

    void import("@/lib/analytics/consent.client")
      .then(async ({ ensureConsentManager, showConsentManager }) => {
        await ensureConsentManager();
        await showConsentManager();
      })
      .catch(() => undefined)
      .finally(() => {
        setPending(false);
      });
  }, [pending]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      aria-label="Privacy preferences"
      data-testid="privacy-preferences"
    >
      {pending ? "…" : "Privacy"}
    </button>
  );
}
