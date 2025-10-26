import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ScrollyProvider, type StepDefinition } from "./ScrollyContext";
import { useStepController, type StepControllerOptions } from "./useStepController";

interface MockEntryInit {
  target: Element;
  intersectionRatio: number;
  rect?: DOMRectReadOnly;
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe() {
    // noop
  }

  unobserve() {
    // noop
  }

  disconnect() {
    // noop
  }

  trigger(entries: MockEntryInit[]) {
    const viewport = createRect(0, 1000);

    const payload = entries.map((entry) => {
      const boundingClientRect = entry.rect ?? getRect(entry.target);
      return {
        target: entry.target,
        intersectionRatio: entry.intersectionRatio,
        isIntersecting: entry.intersectionRatio > 0,
        time: 0,
        boundingClientRect,
        intersectionRect: boundingClientRect,
        rootBounds: viewport,
      } satisfies IntersectionObserverEntry;
    });

    this.callback(payload, this);
  }
}

function createRect(top: number, height: number): DOMRectReadOnly {
  return {
    x: 0,
    y: top,
    width: 100,
    height,
    top,
    left: 0,
    right: 100,
    bottom: top + height,
    toJSON() {
      return {};
    },
  } satisfies DOMRectReadOnly;
}

const elementRects = new Map<Element, DOMRectReadOnly>();

function getRect(element: Element): DOMRectReadOnly {
  const rect = elementRects.get(element);

  if (!rect) {
    throw new Error("Missing rect for element");
  }

  return rect;
}

function setRect(element: Element, rect: DOMRectReadOnly) {
  elementRects.set(element, rect);
}

function createStep(id: string, top: number): StepDefinition {
  const element = document.createElement("div");
  const rect = createRect(top, 200);
  setRect(element, rect);
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => getRect(element),
  });
  document.body.appendChild(element);

  return { id, element };
}

function TestController({ options }: { options?: StepControllerOptions }) {
  const { activeStepId } = useStepController(options);

  return <span data-testid="active-step">{activeStepId ?? "none"}</span>;
}

describe("useStepController", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal(
      "IntersectionObserver",
      MockIntersectionObserver as unknown as IntersectionObserver,
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    MockIntersectionObserver.instances = [];
    elementRects.clear();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("activates steps with hysteresis and event callbacks", async () => {
    const steps = [createStep("step-1", 0), createStep("step-2", 400), createStep("step-3", 800)];
    const onEnter = vi.fn();
    const onExit = vi.fn();
    const onChange = vi.fn();

    render(
      <ScrollyProvider steps={steps}>
        <TestController
          options={{ onStepEnter: onEnter, onStepExit: onExit, onStepChange: onChange }}
        />
      </ScrollyProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("active-step").textContent).toBe("step-1"));
    expect(onEnter).toHaveBeenCalledWith("step-1");
    expect(onChange).toHaveBeenCalledWith("step-1", null);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    const observer = MockIntersectionObserver.instances[0];

    setRect(steps[0].element!, createRect(-150, 200));
    setRect(steps[1].element!, createRect(100, 200));
    await act(async () => {
      observer.trigger([
        { target: steps[0].element!, intersectionRatio: 0.3 },
        { target: steps[1].element!, intersectionRatio: 0.7 },
      ]);
    });

    await waitFor(() => expect(onEnter).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("active-step").textContent).toBe("step-2"));
    expect(onEnter).toHaveBeenLastCalledWith("step-2");
    expect(onExit).toHaveBeenCalledWith("step-1");

    await act(async () => {
      observer.trigger([{ target: steps[1].element!, intersectionRatio: 0.5 }]);
    });
    expect(screen.getByTestId("active-step").textContent).toBe("step-2");

    setRect(steps[1].element!, createRect(-200, 200));
    setRect(steps[2].element!, createRect(100, 200));
    await act(async () => {
      observer.trigger([
        { target: steps[1].element!, intersectionRatio: 0.3 },
        { target: steps[2].element!, intersectionRatio: 0.65 },
      ]);
    });

    await waitFor(() => expect(screen.getByTestId("active-step").textContent).toBe("step-3"));
    expect(onExit).toHaveBeenLastCalledWith("step-2");
    expect(onEnter).toHaveBeenLastCalledWith("step-3");
    expect(onChange).toHaveBeenLastCalledWith("step-3", "step-2");
  });

  it("computes initial step after a double animation frame", async () => {
    const steps = [createStep("step-1", 0), createStep("step-2", 400)];
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      const index = id - 1;
      if (callbacks[index]) {
        callbacks[index] = () => undefined;
      }
    });

    render(
      <ScrollyProvider steps={steps}>
        <TestController />
      </ScrollyProvider>,
    );

    expect(screen.getByTestId("active-step").textContent).toBe("none");

    expect(callbacks).toHaveLength(1);
    const first = callbacks.shift();
    await act(async () => {
      first?.(0);
    });

    expect(screen.getByTestId("active-step").textContent).toBe("none");
    expect(callbacks).toHaveLength(1);

    const second = callbacks.shift();
    await act(async () => {
      second?.(16);
    });

    await waitFor(() => {
      expect(screen.getByTestId("active-step").textContent).toBe("step-1");
    });
  });
});
