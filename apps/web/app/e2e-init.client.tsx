"use client";

import { useEffect, useMemo } from "react";

export default function E2EInit() {
  const isAutomation = useMemo(
    () =>
      typeof navigator !== "undefined" && Boolean((navigator as { webdriver?: boolean }).webdriver),
    [],
  );

  useEffect(() => {
    if (!isAutomation) {
      return;
    }

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
      history.pushState({}, "", url.toString());
      window.dispatchEvent(new Event("popstate"));
    });

    document.body.appendChild(select);

    return () => {
      select.remove();
    };
  }, [isAutomation]);

  return null;
}
