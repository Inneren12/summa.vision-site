// jest-dom матчеры (toBeInTheDocument / toHaveClass / toBeDisabled / ...)
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

// Публичные ENV, чтобы модули не падали в тестах
process.env.NEXT_PUBLIC_APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "App";
process.env.NEXT_PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const globalWithWindow = globalThis as typeof globalThis & { window?: Window; document?: Document };
const hasWindow =
  typeof globalWithWindow.window !== "undefined" &&
  typeof globalWithWindow.document !== "undefined";

if (hasWindow) {
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
  const elementProto = (window.Element?.prototype ?? undefined) as
    | { scrollIntoView?: () => void }
    | undefined;
  if (elementProto && typeof elementProto.scrollIntoView !== "function") {
    elementProto.scrollIntoView = () => {};
  }
}

// IntersectionObserver — стаб: при observe считаем элемент видимым.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).IntersectionObserver === "undefined" && hasWindow) {
  class IO implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0, 1];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(element: Element) {
      const rect = element.getBoundingClientRect();
      const entry: IntersectionObserverEntry = {
        isIntersecting: true,
        target: element,
        intersectionRatio: 1,
        boundingClientRect: rect,
        intersectionRect: rect,
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
