// prettier-ignore
'use client';

import type { EChartsSpec } from "../spec-types";
import type {
  LegacyVizAdapter,
  VizAdapterWithConfig,
  VizInstance,
  VizLifecycleEvent,
} from "../types";

type ECharts = import("echarts").ECharts;

type EChartsInit = (el: HTMLElement, theme?: unknown, opts?: unknown) => ECharts;
type EChartsUse = (mods: unknown[]) => void;
type CoreModule = Partial<{
  init: EChartsInit;
  use: EChartsUse;
}>;

interface EChartsInstance {
  element: HTMLElement | null;
  chart: ECharts | null;
  spec: EChartsSpec | null;
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

export const echartsAdapter: LegacyVizAdapter<EChartsInstance, EChartsSpec> = {
  async mount(el, spec, opts) {
    void opts;
    const [coreMod, charts, components, features, renderers] = await Promise.all([
      import("echarts/core"),
      import("echarts/charts"),
      import("echarts/components"),
      import("echarts/features"),
      import("echarts/renderers"),
    ]);

    const core = coreMod as CoreModule;
    const useFn: EChartsUse = core.use ?? (() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrables: any[] = [
      charts?.LineChart,
      charts?.BarChart,
      charts?.ScatterChart,
      charts?.PieChart,
      components?.GridComponent,
      components?.DatasetComponent,
      components?.TooltipComponent,
      components?.LegendComponent,
      components?.TitleComponent,
      features?.LabelLayout,
      features?.UniversalTransition,
      renderers?.CanvasRenderer,
    ].filter(Boolean);

    if (registrables.length) {
      const applyUse = useFn;
      applyUse(registrables);
    }

    const initFromModule = core.init;
    const fallbackInit: EChartsInit = (element: HTMLElement) =>
      ({
        setOption() {
          /* noop */
        },
        resize() {
          /* noop */
        },
        dispose() {
          /* noop */
        },
        getDom: () => element,
      }) as unknown as ECharts;

    const initFn: EChartsInit =
      typeof initFromModule === "function" ? initFromModule : fallbackInit;

    const chart = initFn(el, undefined, { renderer: "canvas" });
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
    const option: EChartsSpec = typeof next === "function" ? next(previous) : next;
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

interface WrappedEChartsInstance extends VizInstance<EChartsSpec> {
  readonly chart: ECharts | null;
}

function emitLifecycle(
  onEvent: ((event: VizLifecycleEvent) => void) | undefined,
  event: VizLifecycleEvent,
) {
  onEvent?.(event);
}

export const echartsVizAdapter: VizAdapterWithConfig<EChartsSpec, EChartsSpec> = {
  async mount({ el, spec, discrete = false, onEvent, registerResizeObserver }) {
    if (!spec) {
      throw new Error("ECharts adapter requires a specification.");
    }

    const runtime = await echartsAdapter.mount(el, spec, { discrete });

    let resizeCleanup: (() => void) | null = null;
    if (registerResizeObserver) {
      runtime.cleanupResizeObserver?.();
      runtime.cleanupResizeObserver = null;
      resizeCleanup = registerResizeObserver(el, () => {
        runtime.chart?.resize();
        emitLifecycle(onEvent, {
          type: "viz_resized",
          ts: Date.now(),
          meta: { reason: "resize" },
        });
      });
    } else if (runtime.cleanupResizeObserver) {
      resizeCleanup = runtime.cleanupResizeObserver;
      runtime.cleanupResizeObserver = null;
    }

    const instance: WrappedEChartsInstance = {
      applyState(next) {
        echartsAdapter.applyState(runtime, next, { discrete });
      },
      destroy() {
        resizeCleanup?.();
        resizeCleanup = null;
        echartsAdapter.destroy(runtime);
      },
      get chart() {
        return runtime.chart;
      },
    };

    return instance;
  },
};
