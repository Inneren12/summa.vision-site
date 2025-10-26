import type { VizAdapter } from "../types";

export type FakeChartSpec = {
  readonly activeStepId: string | null;
  readonly history: Array<string | null>;
  readonly ready: boolean;
};

export interface FakeChartInstance {
  spec: FakeChartSpec;
}

function cloneHistory(history: Array<string | null>): Array<string | null> {
  return history.slice(0, Math.min(history.length, 100));
}

function cloneSpec(spec: FakeChartSpec): FakeChartSpec {
  return {
    activeStepId: spec.activeStepId,
    ready: spec.ready,
    history: cloneHistory(spec.history),
  };
}

export const fakeChartAdapter: VizAdapter<FakeChartInstance, FakeChartSpec> = {
  mount(_el, spec) {
    return { spec: cloneSpec(spec) };
  },
  applyState(instance, next) {
    const previous = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    instance.spec = cloneSpec(spec);
  },
  destroy(instance) {
    (instance as { spec: FakeChartSpec | null }).spec = null;
  },
};
