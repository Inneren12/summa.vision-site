import { act, fireEvent, render, screen } from "@testing-library/react";

import Step from "../../../components/scrolly/Step";
import StickyPanel from "../../../components/scrolly/StickyPanel";
import Story from "../../../components/scrolly/Story";
import {
  resetMockIntersectionObserver,
  setupMockIntersectionObserver,
  triggerIntersection,
} from "../../tests/utils/mockIntersectionObserver";

describe("Scrollytelling Story", () => {
  beforeAll(() => {
    setupMockIntersectionObserver();
  });

  afterEach(() => {
    resetMockIntersectionObserver();
  });

  const mountStickyPanel = async (container: HTMLElement) => {
    const sentinel = container.querySelector("[data-scrolly-lazy-sentinel]") as HTMLElement | null;
    expect(sentinel).toBeTruthy();
    await act(async () => {
      if (sentinel) {
        triggerIntersection(sentinel);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("renders steps with focus management and aria semantics", async () => {
    const { container } = render(
      <Story stickyTop="calc(var(--space-8) * 2)">
        <StickyPanel>
          <div data-testid="sticky" />
        </StickyPanel>
        <Step id="alpha" title="Первый шаг">
          <p>Описание первого шага.</p>
        </Step>
        <Step id="beta" title="Второй шаг">
          <p>Описание второго шага.</p>
        </Step>
      </Story>,
    );

    expect(screen.queryByTestId("sticky")).not.toBeInTheDocument();

    await mountStickyPanel(container as HTMLElement);

    const storySection = container.querySelector("section.scrolly") as HTMLElement;
    expect(storySection).toBeInTheDocument();
    expect(storySection.style.getPropertyValue("--scrolly-sticky-top")).toBe(
      "calc(var(--space-8) * 2)",
    );

    const steps = screen.getAllByRole("article");
    expect(steps).toHaveLength(2);
    steps.forEach((step) => {
      expect(step).toHaveAttribute("tabindex", "0");
      expect(step).not.toHaveAttribute("aria-current");
    });

    fireEvent.focus(steps[0]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");

    fireEvent.focus(steps[1]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
  });
});
