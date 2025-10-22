/// <reference types="./types/jest-axe" />
import "@testing-library/jest-dom";
import { TextDecoder as NodeTextDecoderImpl, TextEncoder as NodeTextEncoderImpl } from "node:util";

import type { AxeResults, ToHaveNoViolationsFn } from "jest-axe";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

const polyfillTextEncoder = NodeTextEncoderImpl as unknown as typeof globalThis.TextEncoder;
const polyfillTextDecoder = NodeTextDecoderImpl as unknown as typeof globalThis.TextDecoder;

const matcherWrapper: ToHaveNoViolationsFn = toHaveNoViolations.toHaveNoViolations;
expect.extend({
  toHaveNoViolations(this: unknown, results?: AxeResults) {
    return matcherWrapper(results);
  },
});

process.env.NEXT_PUBLIC_APP_NAME ??= "Summa Vision";
process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

const globalWithEncoding = globalThis as typeof globalThis & {
  TextEncoder?: typeof globalThis.TextEncoder;
  TextDecoder?: typeof globalThis.TextDecoder;
};

if (!globalWithEncoding.TextEncoder) {
  globalWithEncoding.TextEncoder = polyfillTextEncoder;
}
if (!globalWithEncoding.TextDecoder) {
  globalWithEncoding.TextDecoder = polyfillTextDecoder;
}

if (typeof window !== "undefined") {
  const windowWithMatchMedia = window as typeof window & {
    matchMedia?: (query: string) => MediaQueryList;
  };

  if (typeof windowWithMatchMedia.matchMedia !== "function") {
    const createStubMatchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;

    windowWithMatchMedia.matchMedia = createStubMatchMedia;
  }
}
