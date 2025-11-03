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

type EChartsSetOptionOptions = {
  readonly notMerge?: boolean;
  readonly lazyUpdate?: boolean;
  readonly silent?: boolean;
};

type ECharts = Omit<import("echarts").ECharts, "setOption"> & {
  setOption(option: unknown, opts?: EChartsSetOptionOptions): void;
};

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

const MOTION_REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") {
    return false;
  }

  try {
    return matchMedia(MOTION_REDUCED_QUERY).matches;
  } catch {
    return false;
  }
}

function resolveDiscreteMotionFlag(discrete?: boolean): boolean {
  if (discrete) {
    return true;
  }
  return prefersReducedMotion();
}

function applyDiscreteMotionDefaults(spec: EChartsSpec, discrete: boolean): EChartsSpec {
  if (!discrete) {
    return spec;
  }

  const overrides = {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    universalTransition: false,
  } as Partial<EChartsSpec>;

  return { ...spec, ...overrides } as EChartsSpec;
}

function setupWindowResizeFallback(
  element: HTMLElement,
  onResize: () => void,
): (() => void) | null {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return null;
  }

  const throttled = throttle(() => {
    onResize();
  }, 100);

  const handler = () => {
    throttled();
  };

  window.addEventListener("resize", handler);

  return () => {
    throttled.cancel();
    window.removeEventListener("resize", handler);
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
  const { state, emit, onEvent, registerResizeObserver, discrete: discreteInput } = options ?? {};
  const specFromState = state?.spec;
  if (!specFromState) {
    throw new Error("ECharts adapter requires a specification.");
  }

  const discrete = resolveDiscreteMotionFlag(discreteInput);
  const emitFn: VizEmit = typeof emit === "function" ? emit : () => {};
  const motionMeta = discrete ? "discrete" : "animated";

  const emitLifecycleEvent = (event: VizLifecycleEvent["type"], meta?: Record<string, unknown>) => {
    const combinedMeta = {
      lib: "echarts",
      motion: motionMeta,
      ...(meta ?? {}),
    };

    try {
      emitFn(event, undefined, combinedMeta);
    } catch {
      // ignore emit failures
    }

    emitLifecycle(onEvent, {
      type: event,
      ts: Date.now(),
      meta: combinedMeta,
    });
  };

  emitLifecycleEvent("viz_init", { reason: "mount" });

  try {
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
    const initialSpec = applyDiscreteMotionDefaults(cloneSpec(specFromState), discrete);
    const internal: { spec?: EChartsSpec } = {
      spec: initialSpec,
    };

    chart.setOption(cloneSpec(internal.spec!), {
      lazyUpdate: true,
    });

    emitLifecycleEvent("viz_ready", { reason: "initial_render" });

    let cleanup: (() => void) | null = null;
    const handleResize = () => {
      try {
        chart.resize?.();
      } catch (error) {
        emitLifecycleEvent("viz_error", {
          reason: "resize",
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      emitLifecycleEvent("viz_resized", { reason: "resize" });
    };

    try {
      cleanup = registerResizeObserver?.(el, handleResize) ?? null;
    } catch {
      cleanup = null;
    }

    if (!cleanup) {
      cleanup = setupWindowResizeFallback(el, handleResize);
    }

    let destroyed = false;

    const instance: EChartsInstance = {
      applyState(next) {
        if (destroyed || !next) {
          return;
        }

        const currentSpec = internal.spec ? cloneSpec(internal.spec) : ({} as EChartsSpec);

        let resolved: EChartsSpec | undefined;
        try {
          const candidate = next as unknown;
          if (typeof candidate === "function") {
            resolved = (candidate as (prev: Readonly<EChartsSpec>) => EChartsSpec)(currentSpec);
          } else if (candidate && typeof candidate === "object" && "spec" in candidate) {
            resolved = (candidate as { spec?: EChartsSpec }).spec;
          } else {
            resolved = candidate as EChartsSpec | undefined;
          }
        } catch (error) {
          emitLifecycleEvent("viz_error", {
            reason: "resolve_state",
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        if (!resolved) {
          return;
        }

        const previous = internal.spec
          ? (cloneSpec(internal.spec) as Record<string, unknown>)
          : ({} as Record<string, unknown>);
        const incoming = cloneSpec(resolved) as Record<string, unknown>;
        const updatedSpec = {
          ...previous,
          ...incoming,
        } as EChartsSpec;

        internal.spec = applyDiscreteMotionDefaults(updatedSpec, discrete);

        try {
          chart.setOption(cloneSpec(internal.spec!), {
            notMerge: false,
            lazyUpdate: true,
            silent: true,
          });
        } catch (error) {
          emitLifecycleEvent("viz_error", {
            reason: "apply_state",
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        emitLifecycleEvent("viz_state", { reason: "apply_state" });
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
  } catch (error) {
    emitLifecycleEvent("viz_error", {
      reason: "mount",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
