// prettier-ignore
'use client';

import type { EChartsSpec } from "../spec-types";
import type {
  RegisterResizeObserver,
  VizAdapterWithConfig,
  VizEmit,
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

interface EChartsInstance extends VizInstance<{ spec: EChartsSpec }> {
  readonly chart: ECharts | null;
  readonly spec: EChartsSpec | undefined;
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

function deepClonePreservingFuncs<T>(input: T, seen = new WeakMap<object, unknown>()): T {
  if (input === null || typeof input !== "object") {
    return input;
  }
  const objectInput = input as unknown as object;
  if (seen.has(objectInput)) {
    return seen.get(objectInput) as T;
  }

  if (input instanceof Date) {
    return new Date(input.getTime()) as unknown as T;
  }
  if (input instanceof RegExp) {
    return new RegExp(input.source, input.flags) as unknown as T;
  }

  if (input instanceof Map) {
    const m = new Map();
    seen.set(objectInput, m);
    for (const [key, value] of input.entries()) {
      m.set(key, deepClonePreservingFuncs(value, seen));
    }
    return m as unknown as T;
  }

  if (input instanceof Set) {
    const s = new Set();
    seen.set(objectInput, s);
    for (const value of input.values()) {
      s.add(deepClonePreservingFuncs(value, seen));
    }
    return s as unknown as T;
  }

  if (Array.isArray(input)) {
    const arr: unknown[] = [];
    seen.set(objectInput, arr);
    for (const item of input) {
      arr.push(deepClonePreservingFuncs(item, seen));
    }
    return arr as unknown as T;
  }

  const out: Record<string, unknown> = Object.create(Object.getPrototypeOf(input));
  seen.set(objectInput, out);
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = typeof value === "function" ? value : deepClonePreservingFuncs(value, seen);
  }
  return out as unknown as T;
}

function cloneSpec<T>(spec: T): T {
  try {
    if (typeof globalThis.structuredClone === "function") {
      // structuredClone throws when the value contains functions
      return globalThis.structuredClone(spec);
    }
  } catch {
    // ignore structuredClone failures
  }
  return deepClonePreservingFuncs(spec);
}

function setupResizeObserver(element: HTMLElement, onResize: () => void): (() => void) | null {
  if (typeof ResizeObserver === "undefined") {
    return null;
  }

  const throttledResize = throttle(() => {
    onResize();
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

type EChartsMountOptions = {
  readonly state?: Readonly<{ spec?: EChartsSpec }>;
  readonly emit?: VizEmit;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
  readonly discrete?: boolean;
};

type EChartsStateUpdate = EChartsSpec | ((prev: Readonly<EChartsSpec>) => EChartsSpec);

async function mount(el: HTMLElement, options: EChartsMountOptions): Promise<EChartsInstance> {
  const { state, emit, onEvent, registerResizeObserver, discrete = false } = options ?? {};
  const specFromState = state?.spec;
  if (!specFromState) {
    throw new Error("ECharts adapter requires a specification.");
  }

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

  const initFn: EChartsInit = typeof initFromModule === "function" ? initFromModule : fallbackInit;

  const chart = initFn(el, undefined, { renderer: "canvas" });
  const initialSpec = cloneSpec(specFromState);
  const internal: { spec?: EChartsSpec } = {
    spec: initialSpec,
  };

  chart.setOption(cloneSpec(internal.spec!), {
    lazyUpdate: true,
  } as never);

  const emitFn: VizEmit = emit ?? (() => {});
  let cleanup: (() => void) | null = null;
  const handleResize = () => {
    chart.resize();
    emitLifecycle(onEvent, {
      type: "viz_resized",
      ts: Date.now(),
      meta: {
        reason: "resize",
        motion: discrete ? "discrete" : "animated",
      },
    });
  };

  try {
    cleanup = registerResizeObserver?.(el, handleResize) ?? null;
  } catch {
    cleanup = null;
  }

  if (!cleanup) {
    cleanup = setupResizeObserver(el, handleResize);
  }

  let destroyed = false;

  const instance: EChartsInstance = {
    applyState(next) {
      if (destroyed || !next?.spec) {
        return;
      }

      const updatedSpec = {
        ...(internal.spec ? (internal.spec as Record<string, unknown>) : {}),
        ...(next.spec as Record<string, unknown>),
      } as EChartsSpec;

      internal.spec = updatedSpec;

      chart.setOption(cloneSpec(internal.spec!), {
        notMerge: false,
        lazyUpdate: true,
        silent: true,
      } as never);

      try {
        emitFn("viz_state", { specApplied: true });
      } catch {
        // ignore emit failures
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      try {
        cleanup?.();
      } catch {
        // ignore cleanup errors
      } finally {
        cleanup = null;
      }

      try {
        chart.dispose?.();
      } catch {
        // ignore dispose errors
      }

      internal.spec = undefined;
    },
    get chart() {
      return destroyed ? null : chart;
    },
    get spec() {
      return internal.spec ? cloneSpec(internal.spec) : undefined;
    },
  };

  return instance;
}

function applyState(
  instance: EChartsInstance,
  next: EChartsStateUpdate,
  opts?: { readonly discrete?: boolean },
) {
  void opts;

  if (!instance || typeof instance.applyState !== "function") {
    return;
  }

  const current = instance.spec ? cloneSpec(instance.spec) : ({} as EChartsSpec);
  const resolved = typeof next === "function" ? next(current) : next;
  instance.applyState({ spec: resolved });
}

function destroy(instance: EChartsInstance) {
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
  readonly chart: ECharts | null;
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
        echartsAdapter.applyState(runtime, next, { discrete });
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
