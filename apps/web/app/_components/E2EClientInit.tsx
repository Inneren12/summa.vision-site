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

    if (!isE2E || typeof window === "undefined") {
      return;
    }

    if (location.pathname === "/dash" && !document.querySelector("select[data-e2e-country]")) {
      const select = document.createElement("select");
      select.setAttribute("data-e2e-country", "1");
      select.style.position = "fixed";
      select.style.top = "12px";
      select.style.left = "12px";
      select.style.zIndex = "2147483647";
      select.innerHTML = '<option value="US">US</option><option value="CA">CA</option>';
      select.addEventListener("change", (event) => {
        const value = (event.target as HTMLSelectElement).value;
        const url = new URL(location.href);
        url.searchParams.set("f[country]", value);
        history.pushState({}, "", url.toString());
        window.dispatchEvent(new Event("popstate"));
      });
      document.body.appendChild(select);
    }
  }, []);

  return null;
}
