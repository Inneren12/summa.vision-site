"use client";

import type { VizAdapterWithConfig, VizEvent, VizInstance, VizLifecycleEvent } from "../types";

import type { EChartsSpec } from "@/lib/viz/spec-types";

type AnyFn = (...args: unknown[]) => unknown;

const asFn = <T extends AnyFn = AnyFn>(module: unknown, key: string, fallback: T): T => {
  const candidate = (module as Record<string, unknown> | undefined)?.[key];
  return typeof candidate === "function" ? (candidate as T) : fallback;
};

type EChartsState = { spec?: EChartsSpec };

type ResizeDisposer = () => void;

interface ChartLike {
  setOption: (option: EChartsSpec, opts?: Record<string, unknown>) => void;
  resize: () => void;
  dispose: () => void;
  getDom?: () => HTMLElement;
}

function cloneSpec(spec?: EChartsSpec): EChartsSpec | undefined {
  if (!spec) {
    return undefined;
  }

  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore structuredClone errors and fall back
    }
  }

  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsSpec;
  }

  if (typeof spec === "object") {
    return { ...(spec as Record<string, unknown>) } as EChartsSpec;
  }

  return spec;
}

function mergeSpecs(specs: Array<EChartsSpec | undefined>): EChartsSpec {
  const merged: Record<string, unknown> = {};
  for (const part of specs) {
    if (!part) {
      continue;
    }
    const clone = cloneSpec(part);
    if (clone && typeof clone === "object") {
      Object.assign(merged, clone as Record<string, unknown>);
    }
  }
  return merged as EChartsSpec;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function createEmitter(
  onEvent: ((event: VizLifecycleEvent) => void) | undefined,
  discrete: boolean,
): (event: VizEvent, meta?: Record<string, unknown>) => void {
  return (event, meta) => {
    if (!onEvent) {
      return;
    }
    const base: Record<string, unknown> = {
      lib: "echarts",
      motion: discrete ? "discrete" : "animated",
    };
    onEvent({
      type: event,
      ts: Date.now(),
      meta: meta ? { ...base, ...meta } : base,
    });
  };
}

export const echartsVizAdapter: VizAdapterWithConfig<EChartsState, EChartsSpec> = {
  async mount({
    el,
    spec,
    initialState,
    discrete: discreteOption,
    onEvent,
    registerResizeObserver,
  }) {
    if (!spec) {
      throw new Error("ECharts adapter requires a specification.");
    }

    const discrete =
      discreteOption === true ||
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      false;

    const emit = createEmitter(onEvent, discrete);
    emit("viz_init", { reason: "mount" });

    try {
      const coreMod = await import("echarts/core");
      const charts = await import("echarts/charts");
      const components = await import("echarts/components");
      const features = await import("echarts/features");
      const renderers = await import("echarts/renderers");

      const registerModules: (modules: unknown[]) => void = asFn(coreMod, "use", () => {});
      const registrables: unknown[] = [
        charts?.LineChart,
        charts?.BarChart,
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
        registerModules(registrables);
      }

      const fallbackInit = (element: HTMLElement) =>
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
        }) satisfies ChartLike;

      const initFn = asFn(coreMod, "init", fallbackInit as AnyFn) as (
        element: HTMLElement,
        theme?: unknown,
        options?: unknown,
      ) => ChartLike;

      const chart: ChartLike = initFn(el, undefined, { renderer: "canvas" });

      const base: EChartsSpec = discrete
        ? {
            animation: false,
            animationDuration: 0,
            animationDurationUpdate: 0,
            animationEasing: "linear",
            universalTransition: false,
          }
        : { universalTransition: false };

      const internal: { spec: EChartsSpec } = {
        spec: mergeSpecs([base, spec, initialState?.spec]),
      };

      chart.setOption(internal.spec, {
        notMerge: false,
        lazyUpdate: true,
        silent: true,
      });

      emit("viz_ready", { reason: "mount" });

      const resize = () => {
        try {
          chart.resize();
          emit("viz_resized");
        } catch (error) {
          emit("viz_error", { message: toErrorMessage(error) });
        }
      };

      let disposeResize: ResizeDisposer | null = null;

      if (registerResizeObserver) {
        disposeResize = registerResizeObserver(el, resize);
      } else if (typeof window !== "undefined") {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onResize = () => {
          if (timer) {
            clearTimeout(timer);
          }
          timer = setTimeout(() => {
            timer = null;
            resize();
          }, 120);
        };
        window.addEventListener("resize", onResize);
        disposeResize = () => {
          window.removeEventListener("resize", onResize);
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        };
      }

      const instance: VizInstance<EChartsState> & { chart: ChartLike } = {
        chart,
        applyState(next) {
          if (!next || typeof next !== "object" || !next.spec) {
            return;
          }

          internal.spec = mergeSpecs([internal.spec, next.spec]);
          chart.setOption(internal.spec, {
            notMerge: false,
            lazyUpdate: true,
            silent: true,
          });
          emit("viz_state", { specApplied: true });
        },
        destroy() {
          try {
            disposeResize?.();
          } catch {
            // ignore resize disposer errors
          }
          try {
            chart.dispose();
          } catch {
            // ignore chart dispose errors
          }
        },
      };

      return instance;
    } catch (error) {
      emit("viz_error", { message: toErrorMessage(error) });
      throw error;
    }
  },
};
