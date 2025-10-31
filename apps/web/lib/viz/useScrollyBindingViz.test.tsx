/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VizAdapter, VizInstance } from "./types";
import { useScrollyBindingViz } from "./useScrollyBindingViz";

vi.mock("../analytics/send", () => ({
  emitVizLifecycleEvent: vi.fn(() => true),
  emitVizEvent: vi.fn(() => true),
}));

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver | undefined;
}

describe("useScrollyBindingViz", () => {
  beforeEach(() => {
    document.cookie = "sv_consent=all";
    vi.spyOn(window, "matchMedia").mockImplementation(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    class MockResizeObserver {
      callback: ResizeObserverCallback;
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
    }

    // @ts-expect-error mock implementation for tests
    global.ResizeObserver = MockResizeObserver;
    // @ts-expect-error mock implementation for tests
    window.ResizeObserver = MockResizeObserver as unknown as typeof window.ResizeObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.ResizeObserver;
    delete window.ResizeObserver;
  });

  it("applies visualization state when active step changes", async () => {
    const destroy = vi.fn();
    const applyState = vi.fn();

    const adapter: VizAdapter<{ count: number }, { count: number }> = {
      mount: vi.fn().mockResolvedValue({
        applyState,
        destroy,
      } satisfies VizInstance<{ count: number }>),
    };

    const element = document.createElement("div");
    document.body.appendChild(element);

    let stepCallback: ((stepId: string | null) => void) | null = null;

    const { result } = renderHook(() =>
      useScrollyBindingViz({
        adapter,
        steps: [
          { id: "alpha", state: { count: 1 } },
          { id: "beta", state: { count: 2 } },
        ],
        initialStepId: "alpha",
        subscribeActiveStep: (callback) => {
          stepCallback = callback;
          return () => {
            stepCallback = null;
          };
        },
      }),
    );

    await act(async () => {
      result.current.ref(element);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(adapter.mount).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.instance).not.toBeNull();
    });
    expect(result.current.activeStepId).toBe("alpha");

    act(() => {
      stepCallback?.("beta");
    });

    await waitFor(() => {
      expect(applyState).toHaveBeenCalledWith({ count: 2 });
    });

    expect(result.current.activeStepId).toBe("beta");
    expect(adapter.mount).toHaveBeenCalledTimes(1);

    document.body.removeChild(element);
  });
});
