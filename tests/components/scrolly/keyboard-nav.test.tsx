/* @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";

import Step from "../../../components/scrolly/Step";
import Story from "../../../components/scrolly/Story";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;

  readonly rootMargin: string = "";

  readonly thresholds: ReadonlyArray<number> = [];

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {}

  observe(target: Element): void {
    void target;
    this.callback([], this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(target: Element): void {
    void target;
  }
}

describe("scrolly keyboard navigation", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  const renderStory = () =>
    render(
      <Story>
        <Step id="step-1" title="Step 1">
          <p>First body</p>
        </Step>
        <Step id="step-2" title="Step 2">
          <label htmlFor="step-2-input">Editable</label>
          <input id="step-2-input" aria-label="Editable" />
          <div data-accepts-keys="true">
            <button type="button">Chart control</button>
          </div>
        </Step>
        <Step id="step-3" title="Step 3">
          <p>Third body</p>
        </Step>
      </Story>,
    );

  it("moves focus to the next step with ArrowDown", async () => {
    renderStory();

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    const secondStep = screen.getByRole("article", { name: "Step 2" });

    await act(async () => {
      firstStep.focus();
    });
    expect(firstStep).toHaveFocus();

    await act(async () => {
      fireEvent.keyDown(firstStep, { key: "ArrowDown" });
    });

    await waitFor(() => {
      expect(secondStep).toHaveFocus();
    });

    expect(secondStep).toHaveAttribute("aria-current", "step");
    expect(firstStep).not.toHaveAttribute("aria-current", "step");
  });

  it("moves focus to the previous step with ArrowUp", async () => {
    renderStory();

    const thirdStep = screen.getByRole("article", { name: "Step 3" });

    await act(async () => {
      thirdStep.focus();
    });

    await act(async () => {
      fireEvent.keyDown(thirdStep, { key: "ArrowUp" });
    });

    await waitFor(() => {
      expect(screen.getByRole("article", { name: "Step 2" })).toHaveFocus();
    });
  });

  it("supports Home and End keys", async () => {
    renderStory();

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    const lastStep = screen.getByRole("article", { name: "Step 3" });
    const middleStep = screen.getByRole("article", { name: "Step 2" });

    await act(async () => {
      middleStep.focus();
    });

    await act(async () => {
      fireEvent.keyDown(middleStep, { key: "End" });
    });

    await waitFor(() => {
      expect(lastStep).toHaveFocus();
    });

    await act(async () => {
      fireEvent.keyDown(lastStep, { key: "Home" });
    });

    await waitFor(() => {
      expect(firstStep).toHaveFocus();
    });
  });

  it("ignores navigation keys from interactive descendants", async () => {
    renderStory();

    const secondStep = screen.getByRole("article", { name: "Step 2" });
    const input = within(secondStep).getByLabelText("Editable");
    const ignoredEvents: CustomEvent[] = [];
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        ignoredEvents.push(event);
      }
    };
    window.addEventListener("kbd_ignored_target", handler);

    await act(async () => {
      input.focus();
    });
    expect(input).toHaveFocus();

    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    expect(secondStep).toHaveAttribute("aria-current", "step");

    await waitFor(() => {
      expect(ignoredEvents).toHaveLength(1);
      expect(ignoredEvents[0].type).toBe("kbd_ignored_target");
      expect(ignoredEvents[0].detail).toMatchObject({
        key: "ArrowDown",
        stepId: "step-2",
        reason: "editable",
      });
    });

    window.removeEventListener("kbd_ignored_target", handler);
  });

  it("does not intercept keyboard events inside containers that accept keys", async () => {
    renderStory();

    const secondStep = screen.getByRole("article", { name: "Step 2" });
    const chartButton = within(secondStep).getByRole("button", { name: "Chart control" });
    const ignoredEvents: CustomEvent[] = [];
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        ignoredEvents.push(event);
      }
    };
    window.addEventListener("kbd_ignored_target", handler);

    await act(async () => {
      chartButton.focus();
    });
    expect(chartButton).toHaveFocus();

    await act(async () => {
      fireEvent.keyDown(chartButton, { key: "ArrowDown" });
    });

    await waitFor(() => {
      expect(chartButton).toHaveFocus();
    });

    expect(secondStep).toHaveAttribute("aria-current", "step");
    await waitFor(() => {
      expect(ignoredEvents).toHaveLength(1);
      expect(ignoredEvents[0].detail).toMatchObject({
        key: "ArrowDown",
        stepId: "step-2",
        reason: "accepts_keys",
      });
    });

    window.removeEventListener("kbd_ignored_target", handler);
  });

  it("emits a navigation event when a step change occurs", async () => {
    renderStory();

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    const navEvents: CustomEvent[] = [];
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        navEvents.push(event);
      }
    };
    window.addEventListener("kbd_nav", handler);

    await act(async () => {
      firstStep.focus();
    });
    expect(firstStep).toHaveFocus();

    await act(async () => {
      fireEvent.keyDown(firstStep, { key: "ArrowDown" });
    });

    await waitFor(() => {
      expect(navEvents).toHaveLength(1);
      expect(navEvents[0].detail).toMatchObject({
        key: "ArrowDown",
        stepId: "step-1",
        direction: "next",
      });
    });

    window.removeEventListener("kbd_nav", handler);
  });
});
