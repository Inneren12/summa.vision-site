import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StorySteps } from "@/app/(visual)/story/StorySteps";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

describe("FakeChart scrolly story integration", () => {
  const observerRecords: Array<{ callback: IntersectionObserverCallback }> = [];

  beforeEach(() => {
    document.cookie = "sv_consent=all";
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

    class MockObserver {
      public readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observerRecords.push({ callback });
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.IntersectionObserver = MockObserver as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    observerRecords.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).IntersectionObserver;
  });

  it("updates visualization state and emits events on step change", async () => {
    const events: string[] = [];
    const listener = (event: Event) => {
      if (event instanceof CustomEvent) {
        events.push(event.type);
      }
    };
    window.addEventListener("viz_state", listener);

    render(<StorySteps />);

    const chart = await screen.findByTestId("fake-chart");
    await waitFor(() => {
      expect(chart.dataset.activeStep).toBe("baseline");
    });

    const activateButton = screen.getByRole("button", { name: /Activation and pilots/i });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(chart.dataset.activeStep).toBe("activation");
    });

    expect(events).toContain("viz_state");

    window.removeEventListener("viz_state", listener);
  });
});
