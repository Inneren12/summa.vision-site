// scrollIntoView polyfill for jsdom
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo } from "react";

import Step from "../../../components/scrolly/Step";
import StickyPanel from "../../../components/scrolly/StickyPanel";
import Story, {
  type StoryVisualizationController,
  STORY_VISUALIZATION_LAZY_ROOT_MARGIN,
  useStoryVisualization,
} from "../../../components/scrolly/Story";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
};

let observerRecords: ObserverRecord[] = [];

function triggerVisualizationIntersection() {
  const record = observerRecords.find(
    (entry) => entry.options?.rootMargin === STORY_VISUALIZATION_LAZY_ROOT_MARGIN,
  );

  if (!record) {
    throw new Error("Visualization sentinel observer was not registered");
  }

  act(() => {
    record.callback(
      [
        {
          isIntersecting: true,
          target: document.createElement("div"),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

describe("Scrollytelling Story", () => {
  beforeEach(() => {
    observerRecords = [];
    class MockIntersectionObserver {
      public readonly callback: IntersectionObserverCallback;
      public readonly options?: IntersectionObserverInit;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        this.options = options;
        observerRecords.push({ callback, options });
      }

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).IntersectionObserver;
  });

  it("renders steps with focus management and aria semantics", () => {
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

  it("lazily mounts the visualization when the sentinel intersects", async () => {
    const { container } = render(
      <Story>
        <StickyPanel>
          <div data-testid="viz" />
        </StickyPanel>
        <Step id="alpha" title="Alpha">
          <p>Первый шаг</p>
        </Step>
      </Story>,
    );

    const stickyPanel = container.querySelector("[data-scrolly-sticky]") as HTMLElement;
    expect(stickyPanel).toHaveAttribute("data-scrolly-sticky-state", "pending");
    expect(screen.queryByTestId("viz")).not.toBeInTheDocument();

    triggerVisualizationIntersection();

    await waitFor(() => {
      expect(screen.getByTestId("viz")).toBeInTheDocument();
    });

    expect(stickyPanel).toHaveAttribute("data-scrolly-sticky-state", "mounted");
  });

  it("prefetches visualization data with abort handling", async () => {
    const prefetch = vi.fn<[AbortSignal], Promise<void>>(() => new Promise(() => {}));
    const { unmount } = render(
      <Story onVisualizationPrefetch={prefetch}>
        <StickyPanel>
          <div data-testid="viz" />
        </StickyPanel>
        <Step id="alpha" title="Alpha">
          <p>Первый шаг</p>
        </Step>
      </Story>,
    );

    triggerVisualizationIntersection();

    await waitFor(() => {
      expect(prefetch).toHaveBeenCalledTimes(1);
    });

    const signal = prefetch.mock.calls[0]?.[0];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("notifies visualization controller with smooth transitions by default", async () => {
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

    const applyState = vi.fn();

    function Visualization() {
      const controller = useMemo<StoryVisualizationController>(
        () => ({
          applyState,
        }),
        [applyState],
      );

      useStoryVisualization(controller);
      return <div data-testid="viz" />;
    }

    render(
      <Story>
        <StickyPanel>
          <Visualization />
        </StickyPanel>
        <Step id="alpha" title="Alpha">
          <p>Первый шаг</p>
        </Step>
        <Step id="beta" title="Beta">
          <p>Второй шаг</p>
        </Step>
      </Story>,
    );

    triggerVisualizationIntersection();

    await waitFor(() => {
      expect(screen.getByTestId("viz")).toBeInTheDocument();
    });

    const steps = screen.getAllByRole("article");
    fireEvent.focus(steps[0]);

    await waitFor(() => {
      expect(applyState).toHaveBeenCalledWith("alpha", { discrete: false });
    });

    fireEvent.focus(steps[1]);

    await waitFor(() => {
      expect(applyState).toHaveBeenLastCalledWith("beta", { discrete: false });
    });
  });

  it("switches visualization to discrete updates when reduced motion is preferred", async () => {
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

    const applyState = vi.fn();

    function Visualization() {
      const controller = useMemo<StoryVisualizationController>(
        () => ({
          applyState,
        }),
        [applyState],
      );

      useStoryVisualization(controller);
      return <div data-testid="viz" />;
    }

    render(
      <Story>
        <StickyPanel>
          <Visualization />
        </StickyPanel>
        <Step id="alpha" title="Alpha">
          <p>Первый шаг</p>
        </Step>
      </Story>,
    );

    triggerVisualizationIntersection();

    await waitFor(() => {
      expect(screen.getByTestId("viz")).toBeInTheDocument();
    });

    const step = screen.getByRole("article");
    fireEvent.focus(step);

    await waitFor(() => {
      expect(applyState).toHaveBeenCalledWith("alpha", { discrete: true });
    });
  });
});
