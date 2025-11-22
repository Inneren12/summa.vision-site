// prettier-ignore
'use client';

import type { EChartsOption } from "../spec-types";
import type {
  RegisterResizeObserver,
  VizAdapterWithConfig,
  VizInstance,
  VizLifecycleEvent,
} from "../types";

type EChartsModule = typeof import("echarts/core");

type EChartsRuntimeInstance = ReturnType<EChartsModule["init"]> | null;

export type EChartsState = { readonly option?: EChartsOption } | undefined;

type EventEmitter = (event: VizLifecycleEvent) => void;

interface EChartsRuntime {
  chart: EChartsRuntimeInstance;
  option: EChartsOption;
  resizeCleanup: (() => void) | null;
  disposed: boolean;
  emitter: EventEmitter | null;
  discrete: boolean;
}

function cloneOption<T>(input: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(input);
    } catch {
      // fallback
    }
  }

  if (input === null || typeof input !== "object") {
    return input as T;
  }

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item) => cloneOption<any>(item)) as unknown as T;
  }

  if (input instanceof Date) {
    return new Date(input.getTime()) as unknown as T;
  }

  if (input instanceof RegExp) {
    return new RegExp(input.source, input.flags) as unknown as T;
  }

  if (ArrayBuffer.isView(input)) {
    // @ts-expect-error slice not on DataView
    return typeof input.slice === "function" ? input.slice() : (input as T);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = cloneOption(value);
  }
  return out as unknown as T;
}

function applyDiscreteMotion(option: EChartsOption): EChartsOption {
  const cloned = cloneOption(option);
  if (!cloned || typeof cloned !== "object") {
    return cloned;
  }

  const target = cloned as Record<string, unknown>;

  target.animation = false;
  target.animationDuration = 0;
  target.animationDurationUpdate = 0;
  target.animationDelay = 0;
  target.animationDelayUpdate = 0;
  target.animationThreshold = 0;
  target.animationEasing = "linear";
  target.animationEasingUpdate = "linear";
  target.transitionDuration = 0;

  const ensureDiscrete = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.map((item) => ensureDiscrete(item));
    }
    if (value && typeof value === "object") {
      const next = { ...(value as Record<string, unknown>) };
      next.animation = false;
      next.animationDuration = 0;
      next.animationDurationUpdate = 0;
      next.animationDelay = 0;
      next.animationDelayUpdate = 0;
      next.animationEasing = "linear";
      next.animationEasingUpdate = "linear";
      next.transitionDuration = 0;
      return next;
    }
    return value;
  };

  if (target.series) {
    target.series = ensureDiscrete(target.series as unknown) as unknown[];
  }

  for (const axisKey of ["xAxis", "yAxis", "radiusAxis", "angleAxis", "singleAxis"]) {
    const value = target[axisKey];
    if (value) {
      target[axisKey] = ensureDiscrete(value as unknown) as unknown;
    }
  }

  if (target.tooltip && typeof target.tooltip === "object") {
    const tooltip = target.tooltip as Record<string, unknown>;
    tooltip.transitionDuration = 0;
    tooltip.animation = false;
  }

  return target as EChartsOption;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function createEmitter(
  onEvent: ((event: VizLifecycleEvent) => void) | undefined,
  discrete: boolean,
  version?: string,
): EventEmitter | null {
  if (!onEvent) {
    return null;
  }
  return (event) => {
    const baseMeta: Record<string, unknown> = {
      lib: "echarts",
      adapter: "echarts",
      motion: discrete ? "discrete" : "animated",
    };
    if (version) {
      baseMeta.version = version;
    }
    onEvent({
      ...event,
      meta: event.meta ? { ...baseMeta, ...event.meta } : baseMeta,
    });
  };
}

function throttle<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait = 150) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastCall = 0;

  const invoke = (...args: TArgs) => {
    lastCall = Date.now();
    timeout = null;
    fn(...args);
  };

  return {
    run(...args: TArgs) {
      const now = Date.now();
      const remaining = wait - (now - lastCall);
      if (remaining <= 0) {
        invoke(...args);
        return;
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => invoke(...args), remaining);
    },
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  };
}

async function setupEcharts() {
  const [core, charts, components, renderers] = await Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]);

  const registrables = [
    charts.LineChart,
    charts.BarChart,
    charts.ScatterChart,
    charts.PieChart,
    charts.RadarChart,
    charts.HeatmapChart,
    charts.MapChart,
    charts.CandlestickChart,
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
    renderers.CanvasRenderer,
  ].filter(Boolean);

  if (typeof core.use === "function" && registrables.length) {
    core.use(registrables);
  }

  const init =
    core.init ??
    ((element: HTMLElement) => ({
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
    }));

  return { init, version: (core as { version?: string }).version, core };
}

function applyResizeHandling(
  runtime: EChartsRuntime,
  el: HTMLElement,
  resize: () => void,
  registerResizeObserver?: RegisterResizeObserver,
) {
  const throttled = throttle(resize, 160);

  if (typeof registerResizeObserver === "function") {
    try {
      runtime.resizeCleanup = registerResizeObserver(el, () => throttled.run());
      if (runtime.resizeCleanup) {
        return;
      }
    } catch {
      // fall through to built-in ResizeObserver
    }
  }

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => throttled.run());
    observer.observe(el);
    runtime.resizeCleanup = () => {
      throttled.cancel();
      observer.unobserve(el);
      observer.disconnect();
    };
    return;
  }

  const handler = () => throttled.run();
  window.addEventListener("resize", handler);
  runtime.resizeCleanup = () => {
    throttled.cancel();
    window.removeEventListener("resize", handler);
  };
}

function resolveNextOption(next?: Partial<EChartsState> | EChartsOption): EChartsOption | null {
  if (!next) return null;
  if (typeof next === "object" && "option" in next) {
    const option = (next as EChartsState)?.option;
    return option ? cloneOption(option) : null;
  }
  return cloneOption(next as EChartsOption);
}

export const echartsAdapter: VizAdapterWithConfig<EChartsState, EChartsOption> = {
  async mount({ el, spec, initialState, discrete = false, onEvent, registerResizeObserver }) {
    const baseOption = cloneOption(spec ?? initialState?.option);
    if (!baseOption) {
      throw new Error("ECharts adapter requires a specification.");
    }

    const runtime: EChartsRuntime = {
      chart: null,
      option: baseOption,
      resizeCleanup: null,
      disposed: false,
      emitter: null,
      discrete,
    };

    let version: string | undefined;
    const emit = createEmitter(onEvent, discrete, version);

    emit?.({ type: "viz_init", ts: Date.now(), meta: { adapter: "echarts" } });

    try {
      const { init, version: detectedVersion } = await setupEcharts();
      version = detectedVersion;
      runtime.emitter = createEmitter(onEvent, discrete, version);

      runtime.chart = init(el, "light", { renderer: "canvas" });

      const prepared = discrete ? applyDiscreteMotion(runtime.option) : cloneOption(runtime.option);
      runtime.chart.setOption(prepared, { notMerge: true, lazyUpdate: false } as const);

      const resize = () => {
        if (!runtime.chart || runtime.disposed) return;
        try {
          runtime.chart.resize();
        } catch (error) {
          runtime.emitter?.({
            type: "viz_error",
            ts: Date.now(),
            meta: { reason: "resize", error: toErrorMessage(error) },
          });
        }
      };

      applyResizeHandling(runtime, el, resize, registerResizeObserver);

      runtime.emitter?.({ type: "viz_ready", ts: Date.now(), meta: { adapter: "echarts" } });
    } catch (error) {
      emit?.({
        type: "viz_error",
        ts: Date.now(),
        meta: { adapter: "echarts", error: toErrorMessage(error) },
      });
      throw error;
    }

    const instance: VizInstance<EChartsState> & { readonly chart: EChartsRuntimeInstance } = {
      get chart() {
        return runtime.chart;
      },
      async applyState(next) {
        if (runtime.disposed || !runtime.chart) return;
        const resolved = resolveNextOption(next);
        if (!resolved) return;
        runtime.option = resolved;

        const prepared = runtime.discrete ? applyDiscreteMotion(resolved) : cloneOption(resolved);
        try {
          runtime.chart.setOption(prepared, { notMerge: true, lazyUpdate: false } as const);
          runtime.emitter?.({ type: "viz_state", ts: Date.now(), meta: { adapter: "echarts" } });
        } catch (error) {
          runtime.emitter?.({
            type: "viz_error",
            ts: Date.now(),
            meta: { adapter: "echarts", error: toErrorMessage(error) },
          });
        }
      },
      async destroy() {
        if (runtime.disposed) return;
        runtime.disposed = true;
        runtime.resizeCleanup?.();
        runtime.resizeCleanup = null;
        try {
          runtime.chart?.dispose();
        } catch {
          // ignore
        }
        runtime.chart = null;
        runtime.option = {};
      },
    };

    return instance;
  },
};

export default echartsAdapter;
