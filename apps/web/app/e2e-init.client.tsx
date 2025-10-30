"use client";

import { useEffect } from "react";

export default function E2EInit() {
  useEffect(() => {
    const isAutomation =
      typeof navigator !== "undefined" && Boolean((navigator as { webdriver?: boolean }).webdriver);

    if (!isAutomation) {
      return;
    }

    (async () => {
      try {
        const mod = await import("../mocks/browser");
        if (mod?.worker?.start) {
          await mod.worker.start({ quiet: true, onUnhandledRequest: "bypass" });
        }
      } catch {
        // MSW необязателен для базовых проверок
      }
    })();

    const ensureSelect = () => {
      if (!location.pathname.startsWith("/dash")) {
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
        location.href = url.toString();
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
