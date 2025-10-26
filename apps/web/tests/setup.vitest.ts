// jest-dom матчеры (toBeInTheDocument / toHaveClass / toBeDisabled / ...)
import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";

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

// IntersectionObserver — стаб: при observe считаем элемент видимым.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).IntersectionObserver === "undefined") {
  class IO implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0, 1];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(element: Element) {
      const entry: IntersectionObserverEntry = {
        isIntersecting: true,
        target: element,
        intersectionRatio: 1,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      };

      this.callback([entry], this);
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  const globalWithIO = globalThis as typeof globalThis & { IntersectionObserver?: typeof IO };
  globalWithIO.IntersectionObserver = IO;
}

// Перестраховка: мок vega-embed, если где-то импортируется напрямую
vi.mock(
  "vega-embed",
  () => ({ default: async () => ({ view: { runAsync: async () => {}, finalize: () => {} } }) }),
  { virtual: true },
);

// Сбрасываем память между тестами (работает при --expose-gc)
afterEach(() => {
  const withGc = globalThis as typeof globalThis & { gc?: () => void };
  const gc = withGc.gc;
  if (typeof gc !== "function") return;
  try {
    gc();
  } catch (error) {
    void error; // игнорируем сбои сборщика мусора в тестах
  }
});
