declare module "jest-axe" {
  export interface AxeResults {
    violations: unknown[];
  }
  export type ToHaveNoViolationsFn = (results?: AxeResults) => {
    pass: boolean;
    message: () => string;
  };
  export function axe(node: Element | Document): Promise<AxeResults>;
  export const toHaveNoViolations: {
    toHaveNoViolations: ToHaveNoViolationsFn;
  };
}

import type {
  Assertion as VitestAssertion,
  AsymmetricMatchersContaining as VitestAsymmetricMatchersContaining,
} from "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> extends VitestAssertion<T> {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining extends VitestAsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
