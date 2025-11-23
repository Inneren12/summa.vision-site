/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VizInstance } from "./types";
import { useScrollyBindingViz } from "./useScrollyBindingViz";

import type {
  ScrollyStepChange,
  SubscribeActiveStep,
} from "@/lib/scrolly/useActiveStepSubscription";

function createStepChange(
  stepId: string | null,
  prevStepId: string | null = null,
): ScrollyStepChange {
  return {
    stepId,
    prevStepId,
    index: -1,
    total: -1,
    direction: prevStepId ? "forward" : "initial",
  };
}

describe("useScrollyBindingViz", () => {
  it("applies visualization state when step changes", async () => {
    let listener: ((step: ScrollyStepChange) => void) | null = null;
    const subscribeActiveStep: SubscribeActiveStep = (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    };

    const applyState = vi.fn();
    const viz: VizInstance<{ value: string }> = { applyState, destroy: vi.fn() };

    renderHook(() =>
      useScrollyBindingViz({
        viz,
        mapStepToState: (step) => (step.stepId ? { value: step.stepId } : null),
        subscribeActiveStep,
      }),
    );

    await act(async () => {
      listener?.(createStepChange("alpha"));
    });

    expect(applyState).toHaveBeenCalledWith({ value: "alpha" });
  });

  it("ignores events until viz instance is ready", async () => {
    let listener: ((step: ScrollyStepChange) => void) | null = null;
    const subscribeActiveStep: SubscribeActiveStep = (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    };

    const applyState = vi.fn();

    const { rerender } = renderHook(
      ({ viz }: { viz: VizInstance<{ ready: boolean }> | null }) =>
        useScrollyBindingViz({
          viz,
          mapStepToState: () => ({ ready: true }),
          subscribeActiveStep,
        }),
      { initialProps: { viz: null } },
    );

    await act(async () => {
      listener?.(createStepChange("alpha"));
    });

    expect(applyState).not.toHaveBeenCalled();

    rerender({ viz: { applyState, destroy: vi.fn() } });

    await act(async () => {
      listener?.(createStepChange("beta", "alpha"));
    });

    expect(applyState).toHaveBeenCalledTimes(1);
    expect(applyState).toHaveBeenCalledWith({ ready: true });
  });

  it("skips updates when mapper returns null", async () => {
    let listener: ((step: ScrollyStepChange) => void) | null = null;
    const subscribeActiveStep: SubscribeActiveStep = (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    };

    const applyState = vi.fn();

    renderHook(() =>
      useScrollyBindingViz({
        viz: { applyState, destroy: vi.fn() },
        mapStepToState: (step) => (step.stepId === "allowed" ? { ready: true } : null),
        subscribeActiveStep,
      }),
    );

    await act(async () => {
      listener?.(createStepChange("blocked"));
      listener?.(createStepChange("allowed", "blocked"));
    });

    expect(applyState).toHaveBeenCalledTimes(1);
    expect(applyState).toHaveBeenCalledWith({ ready: true });
  });

  it("unsubscribes when unmounted", () => {
    const unsubscribe = vi.fn();
    const subscribeActiveStep: SubscribeActiveStep = () => unsubscribe;

    const { unmount } = renderHook(() =>
      useScrollyBindingViz({
        viz: { destroy: vi.fn() },
        // mapper never called because viz.applyState is undefined
        mapStepToState: () => ({ value: 1 }),
        subscribeActiveStep,
      }),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("uses the latest mapper without resubscribing", async () => {
    let listener: ((step: ScrollyStepChange) => void) | null = null;
    const subscribeActiveStep: SubscribeActiveStep = (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    };

    const applyState = vi.fn();

    const { rerender } = renderHook(
      ({ label }: { label: string }) =>
        useScrollyBindingViz({
          viz: { applyState, destroy: vi.fn() },
          mapStepToState: (step) => ({ tag: `${label}:${step.stepId ?? "none"}` }),
          subscribeActiveStep,
        }),
      { initialProps: { label: "first" } },
    );

    await act(async () => {
      listener?.(createStepChange("alpha"));
    });

    rerender({ label: "second" });

    await act(async () => {
      listener?.(createStepChange("beta", "alpha"));
    });

    expect(applyState).toHaveBeenLastCalledWith({ tag: "second:beta" });
  });
});
