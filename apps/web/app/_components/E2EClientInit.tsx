"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __SV_MSW_READY__?: boolean;
  }
}

type Props = {
  enableMsw?: boolean;
};

export default function E2EClientInit({ enableMsw = false }: Props) {
  useEffect(() => {
    if (!enableMsw) return;
    if (typeof window === "undefined") return;
    if (window.__SV_MSW_READY__) return;

    window.__SV_MSW_READY__ = true;
    void import("@/mocks/browser")
      .then((mod) => mod.worker?.start?.({ onUnhandledRequest: "bypass" }))
      .catch(() => {
        window.__SV_MSW_READY__ = false;
      });
  }, [enableMsw]);

  return null;
}
