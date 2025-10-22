import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders provided text", () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("disables button when loading", () => {
    render(
      <Button loading data-testid="loading-btn">
        Loading
      </Button>,
    );

    const button = screen.getByTestId("loading-btn");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("applies the ghost variant styles", () => {
    render(<Button variant="ghost">Ghost</Button>);

    expect(screen.getByRole("button", { name: "Ghost" }).className).toContain(
      "hover:bg-primary/10",
    );
  });
});
