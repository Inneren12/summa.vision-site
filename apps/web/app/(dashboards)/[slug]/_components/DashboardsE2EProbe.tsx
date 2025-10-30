"use client";

import { useEffect } from "react";

export default function DashboardsE2EProbe() {
  const isAutomation =
    typeof navigator !== "undefined" && Boolean((navigator as { webdriver?: boolean }).webdriver);

  useEffect(() => {
    if (!isAutomation) {
      return;
    }

    const probe = () => {
      void fetch("/api/stories?probe=1", { cache: "no-store" }).catch(() => undefined);
    };

    probe();
    window.addEventListener("pageshow", probe);

    return () => {
      window.removeEventListener("pageshow", probe);
    };
  }, [isAutomation]);

  return null;
}
