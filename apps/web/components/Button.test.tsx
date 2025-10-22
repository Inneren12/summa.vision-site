import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies ghost variant styles", () => {
    render(
      <Button variant="ghost" data-testid="ghost">
        Ghost
      </Button>,
    );

    expect(screen.getByTestId("ghost").className).toContain("border-transparent");
  });

  it("supports size variations", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Small" }).className).toContain("py-1");
    expect(screen.getByRole("button", { name: "Large" }).className).toContain("text-base");
  });

  it("disables button when loading", () => {
    render(
      <Button loading onClick={vi.fn()}>
        Loading
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Loading" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("passes through click events when enabled", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Fire</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Fire" }));
    expect(handleClick).toHaveBeenCalled();
  });
});
