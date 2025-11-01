import type { EChartsOption } from "../spec-types";
import type { LegacyVizAdapter } from "../types";

type ECharts = import("echarts").ECharts;
type EChartsCoreModule = typeof import("echarts/core");

interface EChartsInstance {
  element: HTMLElement | null;
  chart: ECharts | null;
  spec: EChartsOption | null;
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

let loadCorePromise: Promise<EChartsCoreModule> | null = null;

async function loadEchartsCore(): Promise<EChartsCoreModule> {
  if (!loadCorePromise) {
    loadCorePromise = (async () => {
      const core = await import("echarts/core");
      const [chartsModule, componentsModule, featuresModule, renderersModule] = await Promise.all([
        import("echarts/charts").catch(() => null),
        import("echarts/components").catch(() => null),
        import("echarts/features").catch(() => null),
        import("echarts/renderers").catch(() => null),
      ]);

      const registrables: unknown[] = [];
      const collectRegistrables = (mod: unknown) => {
        if (!mod || typeof mod !== "object") {
          return;
        }
        for (const value of Object.values(mod as Record<string, unknown>)) {
          if (!value) {
            continue;
          }
          const valueType = typeof value;
          if (valueType === "function" || valueType === "object") {
            registrables.push(value);
          }
        }
      };

      collectRegistrables(chartsModule);
      collectRegistrables(componentsModule);
      collectRegistrables(featuresModule);
      collectRegistrables(renderersModule);

      if (typeof core.use === "function" && registrables.length > 0) {
        core.use(registrables as unknown[]);
      }

      return core;
    })();
  }

  return loadCorePromise;
}

function cloneSpec(spec: EChartsOption): EChartsOption {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsOption;
  }
  return { ...(spec as Record<string, unknown>) } as EChartsOption;
}

function setInitialOption(chart: ECharts, option: EChartsOption) {
  chart.setOption(option, { lazyUpdate: true } as never);
}

function setNextOption(chart: ECharts, option: EChartsOption, discrete: boolean) {
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

export const echartsAdapter: LegacyVizAdapter<EChartsInstance, EChartsOption> = {
  async mount(el, spec, opts) {
    void opts;
    const core = await loadEchartsCore();
    const chart = core.init(el, undefined, { renderer: "canvas" }) as unknown as ECharts;
    const clone = cloneSpec(spec);
    setInitialOption(chart, clone);
    const cleanupResizeObserver = setupResizeObserver(el, chart);
    return { element: el, chart, spec: clone, cleanupResizeObserver };
  },
  applyState(instance, next, opts) {
    const chart = instance.chart;
    const currentSpec = instance.spec;
    if (!chart || !currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const option = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(option);
    instance.spec = clone;
    setNextOption(chart, clone, opts.discrete);
  },
  destroy(instance) {
    instance.cleanupResizeObserver?.();
    instance.cleanupResizeObserver = null;
    instance.chart?.dispose();
    instance.chart = null;
    instance.element = null;
    instance.spec = null;
  },
};
