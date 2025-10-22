import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders placeholder", () => {
    render(<Input placeholder="Type…" />);
    expect(screen.getByPlaceholderText("Type…")).toBeInTheDocument();
  });

  it("marks field as invalid", () => {
    render(<Input placeholder="Type" invalid />);
    const field = screen.getByPlaceholderText("Type");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.className).toContain("border-red-500");
  });

  it("respects disabled prop", () => {
    render(<Input placeholder="Disabled" disabled />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });
});
