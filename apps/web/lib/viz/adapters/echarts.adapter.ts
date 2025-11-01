import type { EChartsOption } from "../spec-types";
import type { LegacyVizAdapter } from "../types";

type ECharts = import("echarts/core").ECharts;
type EChartsCoreModule = typeof import("echarts/core");
type EChartsChartsModule = typeof import("echarts/charts");
type EChartsComponentsModule = typeof import("echarts/components");
type EChartsRenderersModule = typeof import("echarts/renderers");
type EChartsFeaturesModule = typeof import("echarts/features");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function resolveFn<T extends AnyFn = AnyFn>(
  mod: Record<string, unknown> | undefined,
  key: string,
): T | null {
  const v = (mod as { [k: string]: unknown } | undefined)?.[key];
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
    const [coreModule, chartsModule, componentsModule, renderersModule, featuresModule] =
      await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
        import("echarts/features"),
      ]);

    const core = coreModule as EChartsCoreModule;
    const moduleRecord =
      (coreModule as { default?: Record<string, unknown> | undefined }).default ??
      (coreModule as Record<string, unknown> | undefined) ??
      undefined;
    const initFn = resolveFn<EChartsCoreModule["init"]>(moduleRecord, "init") ?? core.init;
    const useFn = resolveFn<EChartsCoreModule["use"]>(moduleRecord, "use") ?? core.use;

    const charts = chartsModule as Partial<EChartsChartsModule> | undefined;
    const components = componentsModule as Partial<EChartsComponentsModule> | undefined;
    const renderers = renderersModule as Partial<EChartsRenderersModule> | undefined;
    const features = featuresModule as Partial<EChartsFeaturesModule> | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrables: any[] = [
      charts?.LineChart,
      charts?.BarChart,
      charts?.ScatterChart,
      charts?.PieChart,
      charts?.RadarChart,
      charts?.HeatmapChart,
      charts?.MapChart,
      charts?.CandlestickChart,
      charts?.SunburstChart,
      charts?.TreeChart,
      charts?.TreemapChart,
      charts?.FunnelChart,
      charts?.GaugeChart,
      charts?.GraphChart,
      charts?.LinesChart,
      charts?.BoxplotChart,
      charts?.PictorialBarChart,
      charts?.ParallelChart,
      charts?.SankeyChart,
      charts?.ThemeRiverChart,
      charts?.CustomChart,
      charts?.EffectScatterChart,
      components?.GridComponent,
      components?.DatasetComponent,
      components?.TooltipComponent,
      components?.LegendComponent,
      components?.TitleComponent,
      components?.VisualMapComponent,
      components?.ToolboxComponent,
      components?.DataZoomComponent,
      components?.TransformComponent,
      components?.MarkPointComponent,
      components?.MarkLineComponent,
      components?.TimelineComponent,
      components?.GraphicComponent,
      components?.AxisPointerComponent,
      components?.AriaComponent,
      renderers?.CanvasRenderer,
      renderers?.SVGRenderer,
      features?.LabelLayout,
      features?.UniversalTransition,
    ].filter(Boolean);

    if (registrables.length > 0) {
      // eslint-disable-next-line react-hooks/rules-of-hooks, @typescript-eslint/no-explicit-any
      useFn(registrables as any[]);
    }

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
