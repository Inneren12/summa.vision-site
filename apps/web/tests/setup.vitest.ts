// scrollIntoView polyfill (jsdom не реализует его)
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollIntoView = function () {};
}

// Перестраховка: IntersectionObserver (если тесты не подменяют сами)
if (typeof globalThis !== "undefined" && !(globalThis as any).IntersectionObserver) {
  class IO {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    observe(_el: Element) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unobserve(_el: Element) {}
    disconnect() {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = IO;
}

// Лёгкий мок vega-embed, чтобы не тащить тяжёлые графики в тестах
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
