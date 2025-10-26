import type { VizAdapter } from "../types";

type ECharts = import("echarts/core").EChartsType;
type EChartsSpec = import("echarts/core").EChartsCoreOption;

interface EChartsInstance {
  element: HTMLElement;
  chart: ECharts;
  spec: EChartsSpec;
  cancelResize: (() => void) | null;
}

const CHART_EXPORTS = [
  "LineChart",
  "BarChart",
  "PieChart",
  "ScatterChart",
  "RadarChart",
  "MapChart",
  "TreeChart",
  "TreemapChart",
  "GraphChart",
  "SankeyChart",
  "GaugeChart",
  "FunnelChart",
  "ParallelChart",
  "HeatmapChart",
  "PictorialBarChart",
  "ThemeRiverChart",
  "SunburstChart",
  "LinesChart",
  "EffectScatterChart",
  "CustomChart",
  "BoxplotChart",
  "CandlestickChart",
] as const;

const COMPONENT_EXPORTS = [
  "GridComponent",
  "GridSimpleComponent",
  "TitleComponent",
  "LegendComponent",
  "LegendPlainComponent",
  "LegendScrollComponent",
  "TooltipComponent",
  "AxisPointerComponent",
  "DatasetComponent",
  "VisualMapComponent",
  "VisualMapContinuousComponent",
  "VisualMapPiecewiseComponent",
  "DataZoomComponent",
  "DataZoomInsideComponent",
  "DataZoomSliderComponent",
  "ToolboxComponent",
  "TimelineComponent",
  "GraphicComponent",
  "MarkPointComponent",
  "MarkLineComponent",
  "MarkAreaComponent",
  "PolarComponent",
  "RadarComponent",
  "GeoComponent",
  "SingleAxisComponent",
  "ParallelComponent",
  "CalendarComponent",
  "AriaComponent",
  "BrushComponent",
] as const;

const FEATURE_EXPORTS = ["LabelLayout", "UniversalTransition"] as const;

const RENDERER_EXPORTS = ["CanvasRenderer"] as const;

const RESIZE_THROTTLE_MS = 100;

type ModuleRecord = Record<string, unknown>;

interface EChartsLoader {
  init: typeof import("echarts/core").init;
}

let loadPromise: Promise<EChartsLoader> | null = null;
let modulesRegistered = false;

function pickModules(source: ModuleRecord, names: readonly string[]): unknown[] {
  const modules: unknown[] = [];
  for (const name of names) {
    let value: unknown;
    try {
      value = source[name];
    } catch {
      value = undefined;
    }
    if (value) {
      modules.push(value);
    }
  }
  return modules;
}

async function loadECharts(): Promise<EChartsLoader> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const [core, charts, components, renderers, features] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
        import("echarts/features"),
      ]);

      if (!modulesRegistered) {
        const modules = [
          ...pickModules(charts as ModuleRecord, CHART_EXPORTS),
          ...pickModules(components as ModuleRecord, COMPONENT_EXPORTS),
          ...pickModules(renderers as ModuleRecord, RENDERER_EXPORTS),
          ...pickModules(features as ModuleRecord, FEATURE_EXPORTS),
        ];
        if (modules.length > 0) {
          core.use(modules as never);
        }
        modulesRegistered = true;
      }

      return { init: core.init } satisfies EChartsLoader;
    })();
  }
  return loadPromise;
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

function applyInitialOption(chart: ECharts, option: EChartsSpec) {
  chart.setOption(option, { lazyUpdate: true } as never);
}

function applyUpdateOption(chart: ECharts, option: EChartsSpec, discrete: boolean) {
  chart.setOption(option, { notMerge: true, lazyUpdate: true, animation: !discrete } as never);
}

function setupResizeObserver(chart: ECharts, element: HTMLElement): (() => void) | null {
  const ResizeObs = globalThis.ResizeObserver;
  if (typeof ResizeObs !== "function") {
    return null;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const observer = new ResizeObs(() => {
    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      chart.resize();
    }, RESIZE_THROTTLE_MS);
  });

  observer.observe(element);

  return () => {
    observer.disconnect();
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

export const echartsAdapter: VizAdapter<EChartsInstance, EChartsSpec> = {
  async mount(el, spec, _opts) {
    void _opts;
    const { init } = await loadECharts();
    const chart = init(el, undefined, { renderer: "canvas" });
    const clone = cloneSpec(spec);
    applyInitialOption(chart, clone);
    return {
      element: el,
      chart,
      spec: clone,
      cancelResize: setupResizeObserver(chart, el),
    };
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const option = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(option);
    instance.spec = clone;
    applyUpdateOption(instance.chart, clone, opts.discrete);
  },
  destroy(instance) {
    instance.cancelResize?.();
    instance.chart.dispose();
  },
};
