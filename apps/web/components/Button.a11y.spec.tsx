/// <reference types="../types/jest-axe" />
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, it, expect } from "vitest";

import { Button } from "./Button";

describe("Button a11y", () => {
  it("has no a11y violations", async () => {
    const { container } = render(<Button>Click</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
