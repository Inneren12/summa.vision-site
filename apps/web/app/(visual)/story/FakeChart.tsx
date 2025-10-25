"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FakeChartState = {
  activeStepId: string | null;
  history: Array<string | null>;
  ready: boolean;
};

type FakeChartHandle = {
  state: FakeChartState;
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

function resetState(state: FakeChartState): void {
  state.activeStepId = null;
  state.history = [];
  state.ready = false;
}

export type FakeChartProps = {
  activeStepId: string | null;
};

export function FakeChart({ activeStepId }: FakeChartProps) {
  const handleRef = useRef<FakeChartHandle>();
  const [isReady, setIsReady] = useState(false);

  if (!handleRef.current) {
    handleRef.current = ensureHandle();
  }

  const activeStep = activeStepId ?? null;
  const handle = handleRef.current;
  if (handle) {
    handle.state.ready = true;
  }

  useEffect(() => {
    const currentHandle = handleRef.current;
    if (!currentHandle) {
      return;
    }
    currentHandle.state.history = [];
    currentHandle.state.ready = true;
    setIsReady(true);
    return () => {
      if (!currentHandle) {
        return;
      }
      resetState(currentHandle.state);
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const currentHandle = handleRef.current;
    if (!currentHandle) {
      return;
    }
    const { history } = currentHandle.state;
    if (history.length === 0 || history[history.length - 1] !== activeStep) {
      history.push(activeStep);
    }
    currentHandle.state.activeStepId = activeStep;
  }, [activeStep]);

  const label = useMemo(
    () => (activeStep ? `Active story step: ${activeStep}` : "No active story step"),
    [activeStep],
  );

  return (
    <div
      aria-hidden="true"
      className="flex h-48 w-full items-center justify-center rounded-2xl border border-muted/30 bg-gradient-to-br from-primary/20 to-primary/5 text-center"
      data-active-step={activeStep ?? ""}
      data-ready={isReady ? "true" : "false"}
      data-testid="fake-chart"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="text-sm font-medium text-fg">
        {activeStep ? `Step: ${activeStep}` : "Awaiting step"}
      </span>
    </div>
  );
}
