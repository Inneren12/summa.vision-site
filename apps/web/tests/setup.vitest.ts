// jest-dom матчеры (toBeInTheDocument / toHaveClass / toBeDisabled / ...)
import "@testing-library/jest-dom/vitest";

// Публичные ENV, чтобы модули не падали в тестах
process.env.NEXT_PUBLIC_APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "App";
process.env.NEXT_PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// matchMedia — нужен next-themes (старое API с addListener/removeListener)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: (query: string): any => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
});

// scrollIntoView — jsdom не реализует
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollIntoView ||= function () {};

// IntersectionObserver — базовый мок
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).IntersectionObserver) {
  class IO {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    observe(_el: Element) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unobserve(_el: Element) {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = IO;
}

// Перестраховка: мок vega-embed, если где-то импортируется напрямую
import { vi } from "vitest";
vi.mock(
  "vega-embed",
  () => ({ default: async () => ({ view: { runAsync: async () => {}, finalize: () => {} } }) }),
  { virtual: true },
);
