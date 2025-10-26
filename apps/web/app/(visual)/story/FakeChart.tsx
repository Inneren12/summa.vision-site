"use client";

import { useEffect, useMemo, useRef } from "react";

import type { FakeChartSpec } from "@/lib/viz/adapters/fake";
import { useVizMount } from "@/lib/viz/useVizMount";

export type FakeChartProps = {
  activeStepId: string | null;
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

export function FakeChart({ activeStepId }: FakeChartProps) {
  const initialSpec = useMemo<FakeChartSpec>(
    () => ({ activeStepId: null, history: [], ready: false }),
    [],
  );

  const handleRef = useRef<FakeChartHandle | null>(null);
  if (!handleRef.current) {
    handleRef.current = ensureHandle();
  }

  const { ref, currentSpec, applyState, isReady } = useVizMount({
    adapter: loadFakeChartAdapter,
    lib: "fake",
    initialSpec,
  });

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.state = currentSpec;
  }, [currentSpec]);

  useEffect(
    () => () => {
      const handle = handleRef.current;
      if (handle) {
        resetHandle(handle);
      }
    },
    [],
  );

  useEffect(() => {
    const step = activeStepId ?? null;
    applyState(
      (prev) => {
        const history = prev.history.slice();
        if (history.length === 0 || history[history.length - 1] !== step) {
          history.push(step);
        }
        return {
          activeStepId: step,
          history,
          ready: true,
        } satisfies FakeChartSpec;
      },
      { stepId: step ?? undefined },
    );
  }, [activeStepId, applyState]);

  const label = useMemo(
    () =>
      currentSpec.activeStepId
        ? `Active story step: ${currentSpec.activeStepId}`
        : "No active story step",
    [currentSpec.activeStepId],
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="flex h-48 w-full items-center justify-center rounded-2xl border border-muted/30 bg-gradient-to-br from-primary/20 to-primary/5 text-center"
      data-active-step={currentSpec.activeStepId ?? ""}
      data-ready={currentSpec.ready || isReady ? "true" : "false"}
      data-history={currentSpec.history.join(",")}
      data-testid="fake-chart"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="text-sm font-medium text-fg">
        {currentSpec.activeStepId ? `Step: ${currentSpec.activeStepId}` : "Awaiting step"}
      </span>
    </div>
  );
}
async function loadFakeChartAdapter() {
  const adapterModule = await import("@/lib/viz/adapters/fake");
  return adapterModule.fakeChartAdapter;
}
