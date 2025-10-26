import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { VizAdapter } from "./types";
import { useVizMount } from "./useVizMount";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

describe("useVizMount", () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts an adapter, applies queued state, and dispatches events", async () => {
    const mount = vi.fn(() => ({ id: "instance", spec: { value: 1 } }));
    const applyState = vi.fn();
    const destroy = vi.fn();

    const adapter: VizAdapter<{ id: string; spec: { value: number } }, { value: number }> = {
      mount,
      applyState,
      destroy,
    };

    const element = document.createElement("div");

    const events: string[] = [];
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        events.push((event.detail as { name?: string }).name ?? event.type);
      }
    };

    window.addEventListener("viz_init", handler);
    window.addEventListener("viz_ready", handler);
    window.addEventListener("viz_state", handler);

    const { result, unmount } = renderHook(() =>
      useVizMount({
        adapter,
        lib: "fake",
        initialSpec: { value: 1 },
      }),
    );

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(element, { value: 1 }, { discrete: false });

    act(() => {
      result.current.applyState({ value: 2 }, { stepId: "alpha" });
    });

    await waitFor(() => {
      expect(applyState).toHaveBeenCalledWith(
        { id: "instance", spec: { value: 1 } },
        { value: 2 },
        {
          discrete: false,
        },
      );
    });

    expect(events).toContain("viz_init");
    expect(events).toContain("viz_ready");
    expect(events).toContain("viz_state");

    unmount();

    expect(destroy).toHaveBeenCalledTimes(1);

    window.removeEventListener("viz_init", handler);
    window.removeEventListener("viz_ready", handler);
    window.removeEventListener("viz_state", handler);
  });

  it("queues state updates until mount resolves", async () => {
    const applyState = vi.fn();
    const destroy = vi.fn();

    const adapter: VizAdapter<{ apply: typeof applyState }, number> = {
      mount: vi.fn().mockImplementation((_, spec) => ({ apply: applyState, spec })),
      applyState,
      destroy,
    };

    const element = document.createElement("div");

    const { result } = renderHook(() =>
      useVizMount<number, number>({
        adapter,
        lib: "fake",
        initialSpec: 1,
      }),
    );

    act(() => {
      result.current.applyState(2);
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(applyState).toHaveBeenCalledWith(expect.objectContaining({ apply: applyState }), 2, {
      discrete: false,
    });
  });
});
