/* @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";
import { describe, expect, it, beforeAll } from "vitest";

import Step from "../../../components/scrolly/Step";
import Story from "../../../components/scrolly/Story";

expect.extend(toHaveNoViolations);

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;

  readonly rootMargin: string = "";

  readonly thresholds: ReadonlyArray<number> = [];

  constructor(_callback: IntersectionObserverCallback) {
    void _callback;
  }

  disconnect(): void {}

  observe(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(): void {}
}

describe("scrolly progress accessibility", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  it("exposes an accessible progressbar with step anchors", async () => {
    const { container } = render(
      <Story>
        <Step id="one" title="Первый шаг">
          <p>Описательный текст</p>
        </Step>
        <Step id="two" title="Второй шаг">
          <p>Второе описание</p>
        </Step>
        <Step id="three" title="Третий шаг">
          <p>Третье описание</p>
        </Step>
      </Story>,
    );

    const progress = screen.getByRole("progressbar", { name: "Прогресс истории" });
    const navigation = screen.getByRole("navigation", { name: "Прогресс истории" });
    const anchors = within(navigation).getAllByRole("link");
    expect(anchors).toHaveLength(3);

    const firstStep = screen.getByRole("article", { name: "Первый шаг" });
    await act(async () => {
      firstStep.focus();
    });

    await waitFor(() => {
      expect(progress).toHaveAttribute("aria-valuenow", "1");
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
