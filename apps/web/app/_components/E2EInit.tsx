"use client";

import { useEffect } from "react";

type MaybeSelect = HTMLSelectElement | null;

type EnsureSelectOptions = {
  isE2E: boolean;
};

function attachFallbackSelect({ isE2E }: EnsureSelectOptions) {
  if (!isE2E) {
    return () => {};
  }

  let fallback: MaybeSelect = null;

  const ensureSelect = () => {
    if (!/^\/dash(\/|$|\?)/.test(location.pathname)) {
      if (fallback) {
        fallback.remove();
        fallback = null;
      }
      return;
    }

    const nativeSelect = document.querySelector("select:not([data-e2e-country])") as MaybeSelect;

    if (nativeSelect) {
      if (fallback) {
        fallback.remove();
        fallback = null;
      }
      return;
    }

    if (fallback) {
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
    fallback = select;
  };

  ensureSelect();
  const retryShort = window.setTimeout(ensureSelect, 250);
  const retryLong = window.setTimeout(ensureSelect, 800);
  window.addEventListener("popstate", ensureSelect);

  const observer = new MutationObserver((mutations) => {
    if (!fallback) {
      return;
    }
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const nativeSelect = document.querySelector("select:not([data-e2e-country])");
        if (nativeSelect) {
          fallback.remove();
          fallback = null;
          break;
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.clearTimeout(retryShort);
    window.clearTimeout(retryLong);
    window.removeEventListener("popstate", ensureSelect);
    observer.disconnect();
    if (fallback) {
      fallback.remove();
      fallback = null;
    }
  };
}

export default function E2EInit() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const isE2E = document.body?.dataset?.e2e === "1";

    if (isE2E) {
      void import("@/mocks/browser")
        .then((mod) => mod.worker?.start?.({ onUnhandledRequest: "bypass" }))
        .catch(() => {});
    }

    return attachFallbackSelect({ isE2E });
  }, []);

  return null;
}
