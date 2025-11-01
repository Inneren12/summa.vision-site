import type { EChartsOption } from "../spec-types";
import type { LegacyVizAdapter } from "../types";

type ECharts = import("echarts").ECharts;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function resolveFn<T extends AnyFn = AnyFn>(
  mod: Record<string, unknown> | undefined,
  key: string,
): T | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (mod as any)?.[key];
  return typeof v === "function" ? (v as T) : null;
}

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
    const [coreMod, charts, components, features, renderers] = await Promise.all([
      import("echarts/core"),
      import("echarts/charts"),
      import("echarts/components"),
      import("echarts/features"),
      import("echarts/renderers"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callUse: (mods: any[]) => void =
      resolveFn(coreMod, "use") ??
      (() => {
        /* no-op в тестах */
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrables: any[] = [
      charts?.BarChart,
      charts?.LineChart,
      charts?.PieChart,
      charts?.ScatterChart,
      components?.GridComponent,
      components?.DatasetComponent,
      components?.TooltipComponent,
      components?.LegendComponent,
      components?.TitleComponent,
      features?.LabelLayout,
      features?.UniversalTransition,
      renderers?.CanvasRenderer,
    ].filter(Boolean);

    if (registrables.length > 0) {
      callUse(registrables);
    }

    const echarts = await import("echarts");
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
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
