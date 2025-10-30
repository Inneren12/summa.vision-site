"use client";

import { useEffect } from "react";

export default function E2EClientInit() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isE2E = document.body?.dataset?.e2e === "1";

    if (isE2E) {
      void import("@/mocks/browser")
        .then((mod) => mod.worker?.start?.({ onUnhandledRequest: "bypass" }))
        .catch(() => {});
    }
  }, []);

  return null;
}
