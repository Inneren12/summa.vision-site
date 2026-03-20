/* @vitest-environment jsdom */

import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendVizAnalytics } from "../analytics/viz";

import type { VizAdapterWithConfig, VizInstance, VizLifecycleEvent } from "./types";
import { useVizMount, type UseVizMountResult } from "./useVizMount";

vi.mock("../analytics/viz", () => ({
  sendVizAnalytics: vi.fn(() => Promise.resolve()),
}));

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver | undefined;
}

type TestInstance = { value: number };

type HarnessProps = {
  adapter: VizAdapterWithConfig<TestInstance, { value: number }>;
  onEvent?: (event: VizLifecycleEvent) => void;
  onUpdate: (result: UseVizMountResult<TestInstance>) => void;
};

function Harness({ adapter, onEvent, onUpdate }: HarnessProps) {
  const viz = useVizMount<TestInstance, { value: number }>({
    adapter,
    spec: { value: 1 },
    initialState: { value: 1 },
    onEvent,
  });

  useEffect(() => {
    onUpdate(viz);
  }, [onUpdate, viz]);

  return <div ref={viz.ref} data-testid="viz-root" />;
}

describe("useVizMount", () => {
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

    // @ts-expect-error: provide mock implementation for tests
    global.ResizeObserver = MockResizeObserver;
    // @ts-expect-error: provide mock implementation for tests
    window.ResizeObserver = MockResizeObserver as unknown as typeof window.ResizeObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.ResizeObserver;
    delete window.ResizeObserver;
  });

  it("mounts an adapter, forwards events, and cleans up on unmount", async () => {
    const destroy = vi.fn();
    const applyState = vi.fn();

    let latest: UseVizMountResult<TestInstance> | null = null;
    const onUpdate = vi.fn((value: UseVizMountResult<TestInstance>) => {
      latest = value;
    });

    const adapter: VizAdapterWithConfig<TestInstance, { value: number }> = {
      mount: vi.fn().mockResolvedValue({
        applyState,
        destroy,
      } satisfies VizInstance<TestInstance>),
    };

    const onEvent = vi.fn();

    const { unmount } = render(<Harness adapter={adapter} onEvent={onEvent} onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(adapter.mount).toHaveBeenCalled();
      expect(latest?.mounted).toBe(true);
      expect(latest?.instance).not.toBeNull();
    });

    expect(onUpdate).toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "viz_ready" }));
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: "viz_error" }));
    expect(sendVizAnalytics).toHaveBeenCalled();

    unmount();

    await waitFor(() => {
      expect(destroy).toHaveBeenCalled();
    });
  });

  it("exposes error when adapter rejects", async () => {
    const adapter: VizAdapterWithConfig<TestInstance, { value: number }> = {
      mount: vi.fn().mockImplementation(async () => {
        throw new Error("failed to initialize");
      }),
    };

    let latest: UseVizMountResult<TestInstance> | null = null;

    render(<Harness adapter={adapter} onUpdate={(viz) => (latest = viz)} />);

    await waitFor(() => {
      expect(adapter.mount).toHaveBeenCalled();
      expect(latest?.error).toBeInstanceOf(Error);
      expect(latest?.mounted).toBe(false);
    });
  });
});
