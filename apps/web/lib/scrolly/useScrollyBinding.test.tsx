import { act, render } from "@testing-library/react";
import { type ReactNode, useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollyProvider, type StepDefinition, useScrollyContext } from "./ScrollyContext";
import {
  type ScrollyBindingStatesMap,
  triggerScrollyBinding,
  useScrollyBinding,
} from "./useScrollyBinding";

interface HarnessProps {
  readonly activeStepId: string | null;
  readonly statesMap: ScrollyBindingStatesMap;
  readonly children?: ReactNode;
}

const steps: StepDefinition[] = [
  { id: "alpha", element: null },
  { id: "beta", element: null },
  { id: "gamma", element: null },
];

function ActiveStepSetter({ activeStepId }: { activeStepId: string | null }) {
  const { setActiveStepId } = useScrollyContext();

  useEffect(() => {
    setActiveStepId(activeStepId);
  }, [activeStepId, setActiveStepId]);

  return null;
}

function BindingSurface({
  statesMap,
  onReady,
}: {
  statesMap: ScrollyBindingStatesMap;
  onReady?: (element: HTMLDivElement) => void;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useScrollyBinding(chartRef, statesMap);

  useEffect(() => {
    if (chartRef.current && onReady) {
      onReady(chartRef.current);
    }
  }, [onReady]);

  return <div data-testid="chart" ref={chartRef} />;
}

function Harness({ activeStepId, statesMap, children }: HarnessProps) {
  return (
    <ScrollyProvider steps={steps} initialStepId={null}>
      <BindingSurface statesMap={statesMap} />
      <ActiveStepSetter activeStepId={activeStepId} />
      {children}
    </ScrollyProvider>
  );
}

describe("useScrollyBinding", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("debounces step state transitions based on the active step", async () => {
    const alphaHandler = vi.fn();
    const betaHandler = vi.fn();
    const statesMap: ScrollyBindingStatesMap = {
      alpha: alphaHandler,
      beta: betaHandler,
    };

    const { rerender } = render(<Harness activeStepId="alpha" statesMap={statesMap} />);

    await act(async () => {});

    rerender(<Harness activeStepId="beta" statesMap={statesMap} />);

    await act(async () => {});

    await act(async () => {
      vi.runAllTimers();
    });

    expect(alphaHandler).not.toHaveBeenCalled();
    expect(betaHandler).toHaveBeenCalledTimes(1);
    expect(betaHandler).toHaveBeenCalledWith({ discrete: false });
  });

  it("passes discrete=true when reduced motion is preferred", async () => {
    const handler = vi.fn();
    const statesMap: ScrollyBindingStatesMap = {
      alpha: handler,
    };

    const matchMediaMock = vi.fn().mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn().mockReturnValue(false),
        }) satisfies MediaQueryList,
    );

    window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia;

    render(<Harness activeStepId="alpha" statesMap={statesMap} />);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ discrete: true });
  });

  it("allows manual activation through the dry-run trigger", async () => {
    const betaHandler = vi.fn();
    const statesMap: ScrollyBindingStatesMap = {
      beta: betaHandler,
    };

    let chartElement: HTMLDivElement | null = null;

    render(
      <ScrollyProvider steps={steps} initialStepId={null}>
        <BindingSurface
          statesMap={statesMap}
          onReady={(element) => {
            chartElement = element;
          }}
        />
      </ScrollyProvider>,
    );

    await act(async () => {});

    expect(chartElement).not.toBeNull();

    await act(async () => {
      triggerScrollyBinding(chartElement as HTMLDivElement, { stepId: "beta" });
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(betaHandler).toHaveBeenCalledTimes(1);
    expect(betaHandler).toHaveBeenCalledWith({ discrete: false });
  });
});
