"use client";

import { useEffect } from "react";

export default function E2EInit() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const isE2E =
      Boolean((navigator as { webdriver?: boolean }).webdriver) ||
      process.env.NEXT_PUBLIC_E2E === "1";

    if (!isE2E) {
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => undefined);
    }

    const ensureSelect = () => {
      if (!location.pathname.startsWith("/dash") && !location.pathname.startsWith("/dashboards")) {
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
        const decodedQuery = url.search.replace(/%5B/g, "[").replace(/%5D/g, "]");
        const nextUrl = `${url.pathname}${decodedQuery}${url.hash}`;
        history.pushState({}, "", nextUrl);
      });
      document.body.appendChild(select);
    };

    ensureSelect();
    const t1 = window.setTimeout(ensureSelect, 250);
    const t2 = window.setTimeout(ensureSelect, 750);
    window.addEventListener("popstate", ensureSelect);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("popstate", ensureSelect);
    };
  }, []);

  return null;
}
