import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import ErrorComponent from "../../app/error";

describe("error boundary", () => {
  it("renders and calls reset", () => {
    const reset = vi.fn();
    render(
      React.createElement(ErrorComponent, {
        error: new Error("boom"),
        reset,
      }),
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(reset).toHaveBeenCalled();
  });
});
