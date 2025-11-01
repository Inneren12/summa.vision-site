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
type SetOptionOpts = Parameters<ECharts["setOption"]>[1];
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

type SupportedTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

type SupportedTypedArrayConstructor<TArray extends SupportedTypedArray = SupportedTypedArray> = {
  new (length: number): TArray;
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
  // primitives & functions
  if (input === null || typeof input !== "object") {
    return input;
  }

  const objectInput = input as unknown as object;
  if (seen.has(objectInput)) {
    return seen.get(objectInput) as T;
  }

  // Date / RegExp
  if (input instanceof Date) {
    return new Date(input.getTime()) as unknown as T;
  }
  if (input instanceof RegExp) {
    return new RegExp(input.source, input.flags) as unknown as T;
  }

  // ArrayBuffer / SharedArrayBuffer
  if (input instanceof ArrayBuffer) {
    const copy = input.slice(0);
    seen.set(objectInput, copy);
    return copy as unknown as T;
  }
  if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) {
    const copy = new SharedArrayBuffer(input.byteLength);
    new Uint8Array(copy).set(new Uint8Array(input));
    seen.set(objectInput, copy);
    return copy as unknown as T;
  }

  // DataView
  if (input instanceof DataView) {
    const clonedBuffer = input.buffer.slice(0);
    const dv = new DataView(clonedBuffer, input.byteOffset, input.byteLength);
    seen.set(objectInput, dv);
    return dv as unknown as T;
  }

  // TypedArray (включая Uint8Array, Float32Array и т.д.)
  if (ArrayBuffer.isView(input)) {
    if (input instanceof DataView) {
      const fallbackBuffer = input.buffer.slice(0);
      const fallbackView = new DataView(fallbackBuffer, input.byteOffset, input.byteLength);
      seen.set(objectInput, fallbackView);
      return fallbackView as unknown as T;
    }

    const typed = input as unknown as SupportedTypedArray;
    let out: SupportedTypedArray;
    if (typeof typed.slice === "function") {
      out = typed.slice() as SupportedTypedArray; // новый буфер и копия значений
    } else {
      const ctor = typed.constructor as SupportedTypedArrayConstructor;
      out = new ctor(typed.length);
      if ("set" in out) {
        (out as SupportedTypedArray & { set(array: typeof typed): void }).set(typed);
      }
    }
    seen.set(objectInput, out);
    return out as unknown as T;
  }

  // Map / Set
  if (input instanceof Map) {
    const m = new Map();
    seen.set(objectInput, m);
    for (const [k, v] of input.entries()) {
      m.set(k, deepClonePreservingFuncs(v, seen));
    }
    return m as unknown as T;
  }
  if (input instanceof Set) {
    const s = new Set();
    seen.set(objectInput, s);
    for (const v of input.values()) {
      s.add(deepClonePreservingFuncs(v, seen));
    }
    return s as unknown as T;
  }

  // Array
  if (Array.isArray(input)) {
    const arr: unknown[] = [];
    seen.set(objectInput, arr);
    for (const item of input) {
      arr.push(deepClonePreservingFuncs(item, seen));
    }
    return arr as unknown as T;
  }

  // Plain object (preserve function fields)
  const out: Record<string, unknown> = Object.create(Object.getPrototypeOf(input));
  seen.set(objectInput, out);
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = typeof v === "function" ? v : deepClonePreservingFuncs(v, seen);
  }
  return out as unknown as T;
}

// быстрый путь — structuredClone, если сработает; иначе — наш клонер
function cloneSpec<T>(spec: T): T {
  try {
    const structuredCloneFn = (
      globalThis as typeof globalThis & {
        structuredClone?: <U>(value: U) => U;
      }
    ).structuredClone;
    if (typeof structuredCloneFn === "function") {
      return structuredCloneFn(spec);
    }
  } catch {
    /* функции внутри — перейдём на ручной клонер */
  }
  return deepClonePreservingFuncs(spec);
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    return Boolean(query?.matches);
  } catch {
    return false;
  }
};

function applyMotionPreferences(spec: EChartsSpec, discrete: boolean): EChartsSpec {
  const cloned = cloneSpec(spec);

  if (!discrete) {
    return cloned;
  }

  if (cloned && typeof cloned === "object" && !Array.isArray(cloned)) {
    const target = cloned as Record<string, unknown>;
    target.animation = false;
    target.animationDuration = 0;
    target.animationDurationUpdate = 0;
    target.universalTransition = false;
  }

  return cloned;
}

function setupWindowResizeFallback(onResize: () => void): (() => void) | null {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return null;
  }

  const throttled = throttle(onResize, 100);

  window.addEventListener("resize", throttled);

  return () => {
    window.removeEventListener("resize", throttled);
    throttled.cancel();
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

  const discreteMode = Boolean(discrete || prefersReducedMotion());
  const hasExternalEmit = typeof emit === "function";

  const fallbackEmit: VizEmit = (event, payload, meta) => {
    if (!onEvent) {
      return;
    }

    const details: Record<string, unknown> = {};
    if (payload && typeof payload === "object") {
      Object.assign(details, payload as Record<string, unknown>);
    } else if (payload !== undefined) {
      details.payload = payload;
    }

    if (meta) {
      Object.assign(details, meta);
    }

    if (!("motion" in details)) {
      details.motion = discreteMode ? "discrete" : "animated";
    }

    if (!("lib" in details)) {
      details.lib = "echarts";
    }

    emitLifecycle(onEvent, {
      type: event,
      ts: Date.now(),
      meta: Object.keys(details).length ? details : undefined,
    });
  };

  const emitFn: VizEmit = hasExternalEmit ? (emit as VizEmit) : fallbackEmit;
  const dispatch = (event: VizLifecycleEvent["type"], meta?: Record<string, unknown>) => {
    try {
      emitFn(event, undefined, meta);
    } catch {
      if (!hasExternalEmit && onEvent) {
        emitLifecycle(onEvent, {
          type: event,
          ts: Date.now(),
          meta,
        });
      }
    }
  };

  const dispatchError = (reason: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dispatch("viz_error", {
      reason,
      error: message,
    });
  };

  let coreMod: unknown;
  let chartsMod: unknown;
  let componentsMod: unknown;
  let featuresMod: unknown;
  let renderersMod: unknown;

  try {
    [coreMod, chartsMod, componentsMod, featuresMod, renderersMod] = await Promise.all([
      import("echarts/core"),
      import("echarts/charts"),
      import("echarts/components"),
      import("echarts/features"),
      import("echarts/renderers"),
    ]);
  } catch (error) {
    dispatchError("module_load", error);
    throw error;
  }

  const core = coreMod as CoreModule;
  const registerWithCore: EChartsUse = core.use ?? (() => {});

  const registrables: unknown[] = [
    (chartsMod as Record<string, unknown> | undefined)?.LineChart,
    (chartsMod as Record<string, unknown> | undefined)?.BarChart,
    (chartsMod as Record<string, unknown> | undefined)?.ScatterChart,
    (chartsMod as Record<string, unknown> | undefined)?.PieChart,
    (componentsMod as Record<string, unknown> | undefined)?.GridComponent,
    (componentsMod as Record<string, unknown> | undefined)?.DatasetComponent,
    (componentsMod as Record<string, unknown> | undefined)?.TooltipComponent,
    (componentsMod as Record<string, unknown> | undefined)?.LegendComponent,
    (componentsMod as Record<string, unknown> | undefined)?.TitleComponent,
    (featuresMod as Record<string, unknown> | undefined)?.LabelLayout,
    (featuresMod as Record<string, unknown> | undefined)?.UniversalTransition,
    (renderersMod as Record<string, unknown> | undefined)?.CanvasRenderer,
  ].filter(Boolean);

  if (registrables.length) {
    try {
      registerWithCore(registrables as unknown[]);
    } catch (error) {
      dispatchError("module_register", error);
      throw error;
    }
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

  dispatch("viz_init", { reason: "init" });

  let chart: ECharts;

  try {
    chart = initFn(el, undefined, { renderer: "canvas" });
  } catch (error) {
    dispatchError("init", error);
    throw error;
  }

  const internal: { spec?: EChartsSpec } = {};

  try {
    internal.spec = applyMotionPreferences(specFromState, discreteMode);
    chart.setOption(cloneSpec(internal.spec), { lazyUpdate: true } satisfies SetOptionOpts);
  } catch (error) {
    dispatchError("set_option_initial", error);
    throw error;
  }

  dispatch("viz_ready", { reason: "initial_render", specApplied: true });

  let destroyed = false;
  let cleanup: (() => void) | null = null;
  const handleResize = () => {
    if (destroyed || !chart || typeof chart.resize !== "function") {
      return;
    }

    try {
      chart.resize();
    } catch (error) {
      dispatchError("resize", error);
      return;
    }

    dispatch("viz_resized", { reason: "resize" });
  };

  if (typeof registerResizeObserver === "function") {
    try {
      const disposer = registerResizeObserver(el, handleResize);
      cleanup = typeof disposer === "function" ? disposer : null;
    } catch (error) {
      dispatchError("register_resize_observer", error);
      cleanup = null;
    }
  }

  if (!cleanup) {
    cleanup = setupWindowResizeFallback(handleResize);
  }

  const instance: EChartsInstance = {
    applyState(next) {
      if (destroyed) {
        return;
      }

      const incoming = next?.spec as EChartsStateUpdate | undefined;
      if (!incoming) {
        return;
      }

      let resolved: EChartsSpec;

      try {
        resolved =
          typeof incoming === "function"
            ? incoming(internal.spec ? cloneSpec(internal.spec) : ({} as EChartsSpec))
            : incoming;
      } catch (error) {
        dispatchError("resolve_state", error);
        return;
      }

      if (!resolved) {
        return;
      }

      try {
        internal.spec = applyMotionPreferences(resolved, discreteMode);
        chart.setOption(cloneSpec(internal.spec), {
          notMerge: false,
          lazyUpdate: true,
          silent: true,
        } satisfies SetOptionOpts);
        dispatch("viz_state", { reason: "apply_state", specApplied: true });
      } catch (error) {
        dispatchError("set_option_state", error);
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
