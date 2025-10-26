import type { EChartsSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type ECharts = import("echarts").ECharts;

interface EChartsInstance {
  element: HTMLElement;
  chart: ECharts;
  spec: EChartsSpec;
  cleanupResizeObserver: (() => void) | null;
}

type Throttled<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel(): void;
};

function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): Throttled<TArgs> {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let trailingArgs: TArgs | null = null;

  const invoke = (args: TArgs) => {
    lastCall = Date.now();
    fn(...args);
  };

  const throttled = ((...args: TArgs) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      trailingArgs = null;
      invoke(args);
      return;
    }

    trailingArgs = args;
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        if (trailingArgs) {
          invoke(trailingArgs);
          trailingArgs = null;
        }
      }, remaining);
    }
  }) as Throttled<TArgs>;

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    trailingArgs = null;
  };

  return throttled;
}

function cloneSpec(spec: EChartsSpec): EChartsSpec {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsSpec;
  }
  return { ...(spec as Record<string, unknown>) } as EChartsSpec;
}

function setInitialOption(chart: ECharts, option: EChartsSpec) {
  chart.setOption(option, { lazyUpdate: true } as never);
}

function setNextOption(chart: ECharts, option: EChartsSpec, discrete: boolean) {
  chart.setOption(option, {
    notMerge: true,
    lazyUpdate: true,
    animation: !discrete,
  } as never);
}

function setupResizeObserver(element: HTMLElement, chart: ECharts): (() => void) | null {
  if (typeof ResizeObserver === "undefined") {
    return null;
  }

  const throttledResize = throttle(() => {
    chart.resize();
  }, 100);

  const observer = new ResizeObserver(() => {
    throttledResize();
  });
  observer.observe(element);

  return () => {
    throttledResize.cancel();
    observer.disconnect();
  };
}

export const echartsAdapter: VizAdapter<EChartsInstance, EChartsSpec> = {
  async mount(el, spec, opts) {
    void opts;
    const echarts = await import("echarts");
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    const clone = cloneSpec(spec);
    setInitialOption(chart, clone);
    const cleanupResizeObserver = setupResizeObserver(el, chart);
    return { element: el, chart, spec: clone, cleanupResizeObserver };
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const option = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(option);
    instance.spec = clone;
    setNextOption(instance.chart, clone, opts.discrete);
  },
  destroy(instance) {
    instance.cleanupResizeObserver?.();
    instance.chart.dispose();
  },
};
