import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Container } from "./Container";

describe("Container", () => {
  it("wraps children with layout classes", () => {
    render(
      <Container>
        <span>Content</span>
      </Container>,
    );

    const wrapper = screen.getByText("Content").parentElement;
    expect(wrapper).toHaveClass("max-w-5xl");
  });
});
