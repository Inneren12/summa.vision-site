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

export const fakeChartAdapter: VizAdapter<FakeChartInstance, FakeChartSpec> = {
  mount(_el, spec) {
    return { spec: { ...spec, history: cloneHistory(spec.history) } };
  },
  applyState(instance, next) {
    const spec = typeof next === "function" ? next(instance.spec) : next;
    instance.spec = {
      ...spec,
      history: cloneHistory(spec.history),
    };
  },
  destroy() {
    // no-op
  },
};
