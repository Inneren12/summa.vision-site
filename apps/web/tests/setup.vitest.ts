// Подключаем матчеры jest-dom (toBeInTheDocument / toHaveClass / toBeDisabled …)
import "@testing-library/jest-dom/vitest";

// polyfill: scrollIntoView (jsdom его не реализует)
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollIntoView = function () {};
}

// polyfill: matchMedia (нужен next-themes)
if (typeof window !== "undefined" && !("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},       // deprecated — на всякий
      removeListener() {},    // deprecated — на всякий
      dispatchEvent: () => false,
    }),
  });
}

// polyfill: IntersectionObserver (если тесты не подменяют сами)
if (typeof globalThis !== "undefined" && !(globalThis as any).IntersectionObserver) {
  class IO {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    observe(_el: Element) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unobserve(_el: Element) {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = IO;
}

// лёгкий мок для vega-embed: тестам не нужен настоящий рантайм
import { vi } from "vitest";
vi.mock(
  "vega-embed",
  () => ({
    default: async (_el: HTMLElement, _spec: unknown, _opts?: unknown) => ({
      view: { runAsync: async () => {}, finalize: () => {} },
    }),
  }),
  { virtual: true },
);
