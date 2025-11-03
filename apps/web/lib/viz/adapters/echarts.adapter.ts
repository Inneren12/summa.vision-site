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

function toErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }
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

function applyDiscreteMotionGuard(spec: EChartsSpec, discrete: boolean): EChartsSpec {
  if (!discrete) {
    return spec;
  }

  return {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    universalTransition: false,
    ...spec,
  } as EChartsSpec;
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
  const { state, emit, onEvent, registerResizeObserver, discrete: discreteOption } = options ?? {};
  const specFromState = state?.spec;
  if (!specFromState) {
    throw new Error("ECharts adapter requires a specification.");
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const discrete = Boolean(discreteOption || prefersReducedMotion);
  const motion = discrete ? "discrete" : "animated";
  const emitFn: VizEmit = typeof emit === "function" ? emit : () => {};
  const emitEvent = (type: VizLifecycleEvent["type"], meta?: Record<string, unknown>) => {
    const detail = { lib: "echarts", motion, ...(meta ?? {}) };
    try {
      emitFn(type, detail);
    } catch {
      // ignore emit failures
    }

    if (!onEvent) {
      return;
    }

    try {
      onEvent({
        type,
        ts: Date.now(),
        meta: detail,
      });
    } catch {
      // ignore lifecycle listener failures
    }
  };

  emitEvent("viz_init", { reason: "mount" });

  const [coreMod, charts, components, features, renderers] = await Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/features"),
    import("echarts/renderers"),
  ]);

  const core = coreMod as CoreModule;
  const register: EChartsUse = core.use ?? (() => {});

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
    try {
      register(registrables as unknown[]);
    } catch (error) {
      emitEvent("viz_error", { reason: "register_modules", message: toErrorMessage(error) });
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

  let chart: ECharts;
  try {
    chart = initFn(el, undefined, { renderer: "canvas" });
  } catch (error) {
    emitEvent("viz_error", { reason: "init", message: toErrorMessage(error) });
    throw error;
  }

  const initialSpec = applyDiscreteMotionGuard(cloneSpec(specFromState), discrete);
  const internal: { spec?: EChartsSpec } = {
    spec: initialSpec,
  };

  try {
    chart.setOption(cloneSpec(internal.spec!), {
      lazyUpdate: true,
    } as never);
  } catch (error) {
    emitEvent("viz_error", { reason: "initial_render", message: toErrorMessage(error) });
    throw error;
  }

  emitEvent("viz_ready", { reason: "mount" });

  const onResize = () => {
    try {
      chart.resize();
      emitEvent("viz_resized", { reason: "resize" });
    } catch (error) {
      emitEvent("viz_error", { reason: "resize", message: toErrorMessage(error) });
    }
  };

  let disposeResize: (() => void) | undefined;

  if (typeof registerResizeObserver === "function") {
    try {
      disposeResize = registerResizeObserver(el, onResize) ?? undefined;
    } catch (error) {
      emitEvent("viz_error", {
        reason: "register_resize_observer",
        message: toErrorMessage(error),
      });
    }
  } else if (typeof window !== "undefined") {
    let throttle: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (throttle) {
        clearTimeout(throttle);
      }
      throttle = setTimeout(() => {
        throttle = null;
        onResize();
      }, 120);
    };
    window.addEventListener("resize", handler);
    disposeResize = () => {
      window.removeEventListener("resize", handler);
    };
  }

  let destroyed = false;

  const instance: EChartsInstance = {
    applyState(next) {
      if (destroyed || !next?.spec) {
        return;
      }

      const base = internal.spec ? cloneSpec(internal.spec) : ({} as EChartsSpec);
      const merged = {
        ...(base as Record<string, unknown>),
        ...(next.spec as Record<string, unknown>),
      } as EChartsSpec;

      internal.spec = applyDiscreteMotionGuard(merged, discrete);

      try {
        chart.setOption(cloneSpec(internal.spec!), {
          notMerge: false,
          lazyUpdate: true,
          silent: true,
        } as never);
        emitEvent("viz_state", { reason: "apply_state" });
      } catch (error) {
        emitEvent("viz_error", { reason: "apply_state", message: toErrorMessage(error) });
        throw error;
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      try {
        disposeResize?.();
      } catch {
        // ignore cleanup errors
      } finally {
        disposeResize = undefined;
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
