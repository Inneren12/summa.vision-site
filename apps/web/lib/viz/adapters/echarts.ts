import type { EChartsOption } from "../spec-types";
import type { LegacyVizAdapter, LegacyVizAdapterOptions } from "../types";

type ECharts = import("echarts/core").EChartsType;
type EChartsInit = typeof import("echarts/core").init;
type EChartsUse = typeof import("echarts/core").use;

interface EChartsInstance {
  element: HTMLElement | null;
  chart: ECharts | null;
  spec: EChartsOption | null;
  cleanupResizeObserver: (() => void) | null;
  discrete: boolean;
  onEvent: LegacyVizAdapterOptions["onEvent"] | null;
}

type Throttled<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel(): void;
};

const LIB_TAG = "echarts";
const RESIZE_THROTTLE_MS = 150;

interface EChartsCoreModule {
  init: EChartsInit;
  use: EChartsUse;
}

let cachedCore: Promise<EChartsCoreModule> | null = null;

function resolveExport<T extends (...args: unknown[]) => unknown>(
  module: Record<string, unknown>,
  name: string,
): T | null {
  const direct = module[name];
  if (typeof direct === "function") {
    return direct as T;
  }

  const defaultExport = module.default;
  if (defaultExport && typeof defaultExport === "object") {
    const candidate = (defaultExport as Record<string, unknown>)[name];
    if (typeof candidate === "function") {
      return candidate as T;
    }
  }

  return null;
}

async function loadEchartsCore(): Promise<EChartsCoreModule> {
  if (!cachedCore) {
    cachedCore = (async () => {
      const [coreModule, charts, components, features, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/features"),
        import("echarts/renderers"),
      ]);

      const moduleRecord = coreModule as unknown as Record<string, unknown>;
      const initFn = resolveExport<EChartsInit>(moduleRecord, "init");
      const useFn =
        resolveExport<EChartsUse>(moduleRecord, "use") ??
        ((modules) => {
          void modules;
        });

      if (!initFn) {
        throw new Error("ECharts core module is missing required exports");
      }

      const modules: unknown[] = [
        charts.BarChart,
        charts.LineChart,
        charts.ScatterChart,
        charts.PieChart,
        charts.RadarChart,
        charts.HeatmapChart,
        charts.MapChart,
        charts.CandlestickChart,
        charts.SunburstChart,
        components.GridComponent,
        components.DatasetComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.TitleComponent,
        components.VisualMapComponent,
        components.ToolboxComponent,
        components.DataZoomComponent,
        components.TransformComponent,
        components.MarkPointComponent,
        components.MarkLineComponent,
        features.LabelLayout,
        features.UniversalTransition,
        features.AriaLabel,
        renderers.CanvasRenderer,
      ].filter(Boolean);

      useFn(modules as Parameters<EChartsUse>[0]);

      return { init: initFn, use: useFn } satisfies EChartsCoreModule;
    })();
  }

  return cachedCore;
}

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
      // structuredClone can throw for non-cloneable values (e.g. functions)
    }
  }

  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsOption;
  }

  return { ...(spec as Record<string, unknown>) } as EChartsOption;
}

function withDiscreteMotion(option: EChartsOption, discrete: boolean): EChartsOption {
  if (!discrete || !option || typeof option !== "object") {
    return option;
  }

  const target = option as Record<string, unknown>;
  target.animation = false;
  target.animationDuration = 0;
  target.animationDurationUpdate = 0;
  target.animationEasing = "linear";
  target.animationEasingUpdate = "linear";
  target.transitionDuration = 0;

  const universal = target.universalTransition;
  if (universal && typeof universal === "object") {
    target.universalTransition = {
      ...(universal as Record<string, unknown>),
      enabled: false,
    };
  } else {
    target.universalTransition = { enabled: false } as unknown;
  }

  return option;
}

function prepareOption(source: EChartsOption, discrete: boolean): EChartsOption {
  const clone = cloneSpec(source);
  return withDiscreteMotion(clone, discrete);
}

function dispatchEvent(
  onEvent: LegacyVizAdapterOptions["onEvent"] | null | undefined,
  discrete: boolean,
  type: "viz_init" | "viz_ready" | "viz_state" | "viz_error",
  meta?: Record<string, unknown>,
) {
  if (!onEvent) {
    return;
  }

  const base: Record<string, unknown> = {
    lib: LIB_TAG,
    motion: discrete ? "discrete" : "animated",
  };

  onEvent({
    type,
    ts: Date.now(),
    meta: meta ? { ...base, ...meta } : base,
  });
}

function emitError(opts: LegacyVizAdapterOptions, reason: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  dispatchEvent(opts.onEvent, opts.discrete, "viz_error", { reason, error: message });
  throw error;
}

function setupResizeObserver(element: HTMLElement, chart: ECharts): (() => void) | null {
  if (typeof ResizeObserver === "undefined") {
    return null;
  }

  const throttledResize = throttle(() => {
    chart.resize();
  }, RESIZE_THROTTLE_MS);

  const observer = new ResizeObserver(() => {
    throttledResize();
  });
  observer.observe(element);

  return () => {
    throttledResize.cancel();
    observer.disconnect();
  };
}

function setOption(chart: ECharts, option: EChartsOption): void {
  chart.setOption(option, {
    notMerge: true,
    lazyUpdate: false,
  } as never);
}

export const echartsAdapter: LegacyVizAdapter<EChartsInstance, EChartsOption> = {
  async mount(el, spec, opts) {
    dispatchEvent(opts.onEvent, opts.discrete, "viz_init");

    let core: EChartsCoreModule;
    try {
      core = await loadEchartsCore();
    } catch (error) {
      emitError(opts, "mount", error);
    }

    try {
      const chart = core.init(el, undefined, { renderer: "canvas" });
      const prepared = prepareOption(spec, opts.discrete);
      setOption(chart, prepared);
      const cleanupResizeObserver = setupResizeObserver(el, chart);
      dispatchEvent(opts.onEvent, opts.discrete, "viz_ready");
      return {
        element: el,
        chart,
        spec: prepared,
        cleanupResizeObserver,
        discrete: opts.discrete,
        onEvent: opts.onEvent ?? null,
      };
    } catch (error) {
      emitError(opts, "mount", error);
    }
  },
  applyState(instance, next, opts) {
    const chart = instance.chart;
    const currentSpec = instance.spec;
    if (!chart || !currentSpec) {
      return;
    }

    try {
      const previous = cloneSpec(currentSpec);
      const option = typeof next === "function" ? next(previous) : next;
      const prepared = prepareOption(option, opts.discrete);
      instance.spec = prepared;
      instance.discrete = opts.discrete;
      instance.onEvent = opts.onEvent ?? instance.onEvent ?? null;
      setOption(chart, prepared);
      dispatchEvent(instance.onEvent, instance.discrete, "viz_state", { reason: "apply" });
    } catch (error) {
      emitError(opts, "applyState", error);
    }
  },
  destroy(instance) {
    instance.cleanupResizeObserver?.();
    instance.cleanupResizeObserver = null;
    instance.chart?.dispose();
    instance.chart = null;
    instance.element = null;
    instance.spec = null;
    dispatchEvent(instance.onEvent, instance.discrete, "viz_state", { reason: "destroy" });
    instance.onEvent = null;
  },
};
