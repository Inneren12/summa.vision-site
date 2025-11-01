// prettier-ignore
'use client';

import type {
  RegisterResizeObserver,
  VizAdapterWithConfig,
  VizEmit,
  VizInstance,
  VizLifecycleEvent,
} from "../types";

import type { EChartsSpec } from "@/lib/viz/spec-types";


type AnyFn = (...args: unknown[]) => unknown;

const asFn = <T extends AnyFn = AnyFn>(mod: unknown, key: string, fallback: T): T => {
  const fn = (mod as Record<string, unknown> | null | undefined)?.[key];
  return typeof fn === "function" ? (fn as T) : fallback;
};

type EChartsLike = {
  setOption: (...args: unknown[]) => void;
  resize: (...args: unknown[]) => void;
  dispose?: () => void;
  getDom?: () => HTMLElement;
};

type CoreModule = {
  init?: (el: HTMLElement, theme?: unknown, opts?: unknown) => EChartsLike;
  use?: (mods: unknown[]) => void;
};

type EChartsMountOptions = {
  readonly state?: Readonly<{ spec?: EChartsSpec }>;
  readonly emit?: VizEmit;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
  readonly discrete?: boolean;
};

type EChartsStateUpdate = Partial<{ spec: EChartsSpec }>;

const cloneSpec = (spec: EChartsSpec | undefined): EChartsSpec | undefined => {
  if (!spec) {
    return undefined;
  }

  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec) as EChartsSpec;
    } catch {
      // ignore clone errors and fall through to shallow clone
    }
  }

  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsSpec;
  }

  return { ...(spec as Record<string, unknown>) } as EChartsSpec;
};

async function mount(el: HTMLElement, opts: EChartsMountOptions) {
  const emit: VizEmit = opts?.emit ?? (() => {});

  emit("viz_init");

  try {
    const discrete =
      opts?.discrete === true ||
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      false;

    const coreMod = (await import("echarts/core")) as CoreModule;
    const charts = await import("echarts/charts");
    const components = await import("echarts/components");
    const features = await import("echarts/features");
    const renderers = await import("echarts/renderers");

    const applyUse: (mods: unknown[]) => void = asFn(coreMod, "use", () => {});
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

    if (registrables.length) {
      applyUse(registrables);
    }

    const fallbackInit: AnyFn = ((element: HTMLElement) => ({
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
    })) as AnyFn;

    const initFn: AnyFn = asFn(coreMod, "init", fallbackInit);

    const base: EChartsSpec = discrete
      ? {
          animation: false,
          animationDuration: 0,
          animationDurationUpdate: 0,
          animationEasing: "linear",
          universalTransition: false,
        }
      : { universalTransition: false };

    const stateSpecRaw = opts?.state?.spec;
    if (!stateSpecRaw) {
      throw new Error("ECharts adapter requires a specification.");
    }

    const stateSpec = cloneSpec(stateSpecRaw);
    const initialSpec = {
      ...(base as Record<string, unknown>),
      ...(stateSpec as Record<string, unknown> | undefined),
    } as EChartsSpec;

    const internal: { spec?: EChartsSpec } = {
      spec: initialSpec,
    };

    const chart = initFn(el, undefined, { renderer: "canvas" }) as EChartsLike;
    chart.setOption(internal.spec, { notMerge: false, lazyUpdate: true, silent: true });

    emit("viz_ready");

    const resizeHandler = () => {
      try {
        chart.resize();
        emit("viz_resized");
      } catch (error) {
        emit("viz_error", { message: (error as Error)?.message ?? "resize failed" });
      }
    };

    const disposer = opts?.registerResizeObserver
      ? opts.registerResizeObserver(el, resizeHandler)
      : (() => {
          if (typeof window === "undefined") {
            return () => {};
          }

          let timer: ReturnType<typeof setTimeout> | null = null;
          const onResize = () => {
            if (timer) {
              clearTimeout(timer);
            }
            timer = setTimeout(() => {
              timer = null;
              resizeHandler();
            }, 120);
          };

          window.addEventListener("resize", onResize);

          return () => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
            window.removeEventListener("resize", onResize);
          };
        })();

    const instance: VizInstance<{ spec: EChartsSpec }> & { chart: EChartsLike | null } = {
      applyState(next: EChartsStateUpdate) {
        if (!next?.spec) {
          return;
        }

        const merged = {
          ...(internal.spec as Record<string, unknown> | undefined),
          ...(cloneSpec(next.spec) as Record<string, unknown> | undefined),
        } as EChartsSpec;

        internal.spec = merged;

        chart.setOption(merged, { notMerge: false, lazyUpdate: true, silent: true });

        emit("viz_state", { specApplied: true });
      },
      destroy() {
        try {
          disposer?.();
        } catch (error) {
          emit("viz_error", { message: (error as Error)?.message ?? "resize cleanup failed" });
        }

        try {
          chart.dispose?.();
        } catch (error) {
          emit("viz_error", { message: (error as Error)?.message ?? "dispose failed" });
        }

        internal.spec = undefined;
      },
      get chart() {
        return internal.spec ? chart : null;
      },
      get spec() {
        return internal.spec;
      },
    };

    return instance;
  } catch (error) {
    emit("viz_error", { message: (error as Error)?.message ?? "mount failed" });
    throw error;
  }
}

function applyState(
  instance: VizInstance<{ spec: EChartsSpec }> & { chart: EChartsLike | null },
  next: EChartsSpec | ((prev: Readonly<EChartsSpec>) => EChartsSpec),
) {
  if (!instance || typeof instance.applyState !== "function") {
    return;
  }

  const current = instance.spec ?? ({} as EChartsSpec);
  const resolved = typeof next === "function" ? next(current) : next;

  instance.applyState({ spec: resolved });
}

function destroy(instance: VizInstance<{ spec: EChartsSpec }> & { chart: EChartsLike | null }) {
  if (!instance) {
    return;
  }

  try {
    instance.destroy();
  } catch {
    // ignore destroy errors
  }
}

export const echartsAdapter = { mount, applyState, destroy };

interface WrappedEChartsInstance extends VizInstance<EChartsSpec> {
  readonly chart: EChartsLike | null;
  readonly spec: EChartsSpec | undefined;
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

    const emit: VizEmit = (event, payload, meta) => {
      if (!onEvent) {
        return;
      }

      const base: Record<string, unknown> = {
        lib: "echarts",
        motion: discrete ? "discrete" : "animated",
      };

      if (payload && typeof payload === "object") {
        Object.assign(base, payload as Record<string, unknown>);
      } else if (payload !== undefined) {
        base.payload = payload;
      }

      if (meta) {
        Object.assign(base, meta);
      }

      emitLifecycle(onEvent, {
        type: event,
        ts: Date.now(),
        meta: base,
      });
    };

    const runtime = await echartsAdapter.mount(el, {
      state: { spec },
      emit,
      onEvent,
      registerResizeObserver,
      discrete,
    });

    const instance: WrappedEChartsInstance = {
      applyState(next) {
        echartsAdapter.applyState(runtime, next);
      },
      destroy() {
        echartsAdapter.destroy(runtime);
      },
      get chart() {
        return runtime.chart;
      },
      get spec() {
        return runtime.spec;
      },
    };

    return instance;
  },
};
