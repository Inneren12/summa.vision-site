declare module "jest-axe" {
  import type { AxeResults, RunOptions } from "axe-core";

  export type AxeMatcherResult = {
    pass: boolean;
    message(): string;
    actual?: unknown;
  };

  export function axe(node: Element | Document, options?: RunOptions): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(results: unknown): AxeMatcherResult;
  };
}

import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toHaveNoViolations(this: Assertion<T>): void;
  }

  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
