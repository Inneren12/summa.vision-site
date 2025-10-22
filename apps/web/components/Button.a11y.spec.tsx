import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";

expect.extend(toHaveNoViolations);

describe("Button accessibility", () => {
  it("has no detectable a11y violations", async () => {
    const { container } = render(<Button>Click me</Button>);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
