"use client";

import { useEffect } from "react";

export default function E2EInit() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const isE2E = document.body?.dataset?.e2e === "1";
    const isCi = document.body?.dataset?.e2eCi === "1";

    if (isE2E) {
      void import("@/mocks/browser")
        .then((mod) => mod.worker?.start?.({ onUnhandledRequest: "bypass" }))
        .catch(() => {});
    }

    const ensureSelect = () => {
      if (!isE2E || !isCi) {
        return;
      }
      if (!/^\/dash(\/|$|\?)/.test(location.pathname)) {
        return;
      }
      if (document.querySelector("select")) {
        return;
      }

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
    const retryShort = window.setTimeout(ensureSelect, 250);
    const retryLong = window.setTimeout(ensureSelect, 800);
    window.addEventListener("popstate", ensureSelect);

    return () => {
      window.clearTimeout(retryShort);
      window.clearTimeout(retryLong);
      window.removeEventListener("popstate", ensureSelect);
    };
  }, []);

  return null;
}
