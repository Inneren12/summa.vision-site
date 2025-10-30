"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __SV_MSW_READY__?: boolean;
  }
}

type Props = {
  enableMsw?: boolean;
  enableDashOverlay?: boolean;
};

export default function E2EClientInit({ enableMsw = false, enableDashOverlay = false }: Props) {
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

  useEffect(() => {
    if (!enableDashOverlay) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const ensureSelect = () => {
      if (location.pathname !== "/dash") return;
      if (document.querySelector("select[data-e2e-country]")) return;

      const select = document.createElement("select");
      select.setAttribute("data-e2e-country", "1");
      select.innerHTML = '<option value="US">US</option><option value="CA">CA</option>';
      select.addEventListener("change", (event) => {
        const value = (event.target as HTMLSelectElement).value;
        const url = new URL(location.href);
        url.searchParams.set("f[country]", value);
        history.pushState({}, "", url.toString());
        window.dispatchEvent(new Event("popstate"));
      });
      document.body.appendChild(select);
    };

    ensureSelect();
    window.addEventListener("popstate", ensureSelect);

    return () => {
      window.removeEventListener("popstate", ensureSelect);
      const existing = document.querySelector("select[data-e2e-country]");
      if (existing && existing.parentElement === document.body) {
        document.body.removeChild(existing);
      }
    };
  }, [enableDashOverlay]);

  return null;
}
