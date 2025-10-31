"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { VizAdapter, VizInstance } from "@/lib/viz/types";
import { useVizMount } from "@/lib/viz/useVizMount";

export type FakeChartProps = {
  activeStepId: string | null;
};

export type FakeChartSpec = {
  activeStepId: string | null;
  history: Array<string | null>;
  ready: boolean;
};

type FakeChartHandle = {
  state: FakeChartSpec;
};

declare global {
  // eslint-disable-next-line no-var
  var __fakeChart: FakeChartHandle | undefined;
}

function ensureHandle(): FakeChartHandle {
  if (!globalThis.__fakeChart) {
    globalThis.__fakeChart = {
      state: {
        activeStepId: null,
        history: [],
        ready: false,
      },
    };
  }
  return globalThis.__fakeChart;
}

function resetHandle(handle: FakeChartHandle): void {
  handle.state = {
    activeStepId: null,
    history: [],
    ready: false,
  };
}

const fakeChartAdapter: VizAdapter<FakeChartSpec, FakeChartSpec> = {
  async mount({ el, initialState, onEvent }) {
    const state: FakeChartSpec = {
      activeStepId: initialState?.activeStepId ?? null,
      history: [...(initialState?.history ?? [])],
      ready: initialState?.ready ?? false,
    };

    const render = () => {
      el.dataset.activeStep = state.activeStepId ?? "";
      el.dataset.history = state.history.join(",");
      el.dataset.ready = state.ready ? "true" : "false";
    };

    render();

    return {
      applyState(next) {
        state.activeStepId = next.activeStepId ?? state.activeStepId;
        state.history = Array.isArray(next.history) ? next.history.slice() : state.history;
        state.ready = typeof next.ready === "boolean" ? next.ready : state.ready;
        render();
        onEvent?.({
          type: "viz_state",
          ts: Date.now(),
          meta: {
            stepId: state.activeStepId ?? undefined,
          },
        });
      },
      destroy() {
        el.removeAttribute("data-active-step");
        el.removeAttribute("data-history");
        el.removeAttribute("data-ready");
      },
    } satisfies VizInstance<FakeChartSpec>;
  },
};

export function FakeChart({ activeStepId }: FakeChartProps) {
  const initialSpec = useMemo<FakeChartSpec>(
    () => ({ activeStepId: null, history: [], ready: false }),
    [],
  );

  const handleRef = useRef<FakeChartHandle | null>(null);
  if (!handleRef.current) {
    handleRef.current = ensureHandle();
  }

  const [chartState, setChartState] = useState<FakeChartSpec>(initialSpec);

  const viz = useVizMount<FakeChartSpec, FakeChartSpec>({
    adapter: fakeChartAdapter,
    initialState: initialSpec,
    spec: initialSpec,
  });

  useEffect(() => {
    handleRef.current!.state = chartState;
  }, [chartState]);

  useEffect(() => {
    return () => {
      const handle = handleRef.current;
      if (handle) {
        resetHandle(handle);
      }
    };
  }, []);

  useEffect(() => {
    if (!viz.instance) {
      return;
    }

    const step = activeStepId ?? null;
    setChartState((previous) => {
      const history = previous.history.slice();
      if (history.length === 0 || history[history.length - 1] !== step) {
        history.push(step);
      }
      const nextState: FakeChartSpec = {
        activeStepId: step,
        history,
        ready: true,
      };
      viz.instance?.applyState(nextState);
      return nextState;
    });
  }, [activeStepId, viz.instance]);

  const label = useMemo(
    () =>
      chartState.activeStepId
        ? `Active story step: ${chartState.activeStepId}`
        : "No active story step",
    [chartState.activeStepId],
  );

  return (
    <div
      ref={viz.ref}
      className="flex h-48 w-full items-center justify-center rounded-2xl border border-muted/30 bg-gradient-to-br from-primary/20 to-primary/5 text-center"
      data-active-step={chartState.activeStepId ?? ""}
      data-accepts-keys="true"
      data-ready={chartState.ready ? "true" : "false"}
      data-history={chartState.history.join(",")}
      data-testid="fake-chart"
      aria-label={label}
      role="application"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <span aria-hidden="true" className="text-sm font-medium text-fg">
        {chartState.activeStepId ? `Step: ${chartState.activeStepId}` : "Awaiting step"}
      </span>
    </div>
  );
}
