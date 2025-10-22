import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import ErrorComponent from "./error";

describe("error boundary", () => {
  it("renders and calls reset", () => {
    const reset = vi.fn();
    render(<ErrorComponent error={new Error("boom")} reset={reset} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(reset).toHaveBeenCalled();
  });
});
