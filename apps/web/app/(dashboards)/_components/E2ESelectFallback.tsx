"use client";

import { useEffect } from "react";

export default function E2ESelectFallback() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const isE2E = document.body?.dataset?.e2e === "1";
    if (!isE2E) {
      return;
    }

    const ensureSelect = () => {
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
    const retry = window.setTimeout(ensureSelect, 500);

    return () => {
      window.clearTimeout(retry);
    };
  }, []);

  return null;
}
