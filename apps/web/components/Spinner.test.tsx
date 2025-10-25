import { render } from "@testing-library/react";

import { Spinner } from "./Spinner";

describe("Spinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows spinning indicator when motion is allowed", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<Spinner />);
    const spinner = container.querySelector("div[role='progressbar']");
    expect(spinner).toHaveClass("animate-spin");
  });

  it("disables animation when reduced motion is preferred", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<Spinner />);
    const spinner = container.querySelector("div[role='progressbar']");
    expect(spinner).not.toHaveClass("animate-spin");
  });
});
