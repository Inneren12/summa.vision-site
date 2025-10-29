// Worker-like globals for workbox when importing next-pwa under Node.
const globalScope = globalThis as typeof globalThis &
  Record<string, unknown> & {
    __WB_DISABLE_DEV_LOGS?: boolean;
  };

if (typeof (globalScope as Record<string, unknown>).self === "undefined") {
  (globalScope as Record<string, unknown>).self = globalScope;
}

// Optionally silence workbox dev logs in tests.
globalScope.__WB_DISABLE_DEV_LOGS = true;

import "@testing-library/jest-dom";

process.env.NEXT_PUBLIC_APP_NAME ??= "Summa Vision";
process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes("(prefers-color-scheme: dark)") ? false : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}
