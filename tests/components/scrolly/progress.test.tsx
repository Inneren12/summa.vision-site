/* @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { act, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { beforeAll, describe, expect, it } from "vitest";

import Progress from "../../../components/scrolly/Progress";
import Step from "../../../components/scrolly/Step";
import StickyPanel from "../../../components/scrolly/StickyPanel";
import Story from "../../../components/scrolly/Story";

expect.extend(toHaveNoViolations);

describe("scrolly progress", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: class implements IntersectionObserver {
        readonly root: Element | Document | null = null;
        readonly rootMargin = "0px";
        readonly thresholds: ReadonlyArray<number> = [];
        private readonly callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
        disconnect(): void {}
        observe(target: Element): void {
          const element = target as HTMLElement;
          if (!element.dataset.scrollyVizSentinel) {
            return;
          }
          const rect = element.getBoundingClientRect();
          const entry = {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
            time: Date.now(),
          } as IntersectionObserverEntry;
          this.callback([entry], this);
        }
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
        unobserve(): void {}
      },
    });
  });

  it("exposes progress semantics and passes axe checks", async () => {
    const { container } = render(
      <Story storyId="progress-story">
        <StickyPanel>
          <Progress />
        </StickyPanel>
        <Step id="step-1" title="Step 1">
          <p>First</p>
        </Step>
        <Step id="step-2" title="Step 2">
          <p>Second</p>
        </Step>
      </Story>,
    );

    const progressbar = await screen.findByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuemin", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "2");
    expect(progressbar).not.toHaveAttribute("aria-valuenow");
    expect(progressbar).not.toHaveAttribute("aria-valuetext");

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const secondStep = screen.getByRole("article", { name: "Step 2" });
    await act(async () => {
      secondStep.focus();
    });

    expect(progressbar).toHaveAttribute("aria-valuenow", "2");
    expect(progressbar).toHaveAttribute("aria-valuetext", "Step 2");
  });
});
