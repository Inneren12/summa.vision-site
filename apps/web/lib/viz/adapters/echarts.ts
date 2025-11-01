import type { EChartsOption } from "../spec-types";
import type { LegacyVizAdapter, RegisterResizeObserver, VizEvent } from "../types";

type EChartsCoreModule = typeof import("echarts/core");
type EChartsInstanceType = ReturnType<EChartsCoreModule["init"]>;

type AdapterMountOptions = {
  readonly discrete: boolean;
  readonly onEvent?: (event: VizEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
};

type AdapterApplyOptions = {
  readonly discrete: boolean;
  readonly onEvent?: (event: VizEvent) => void;
};

interface EChartsInstance {
  element: HTMLElement | null;
  chart: EChartsInstanceType | null;
  spec: EChartsOption | null;
  cleanupResizeObserver: (() => void) | null;
  onEvent: ((event: VizEvent) => void) | null;
  discrete: boolean;
}

type Throttled<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel(): void;
};

const DISCRETE_MOTION_OPTIONS = {
  animation: false,
  animationDuration: 0,
  animationDurationUpdate: 0,
  animationEasing: "linear",
  animationEasingUpdate: "linear",
  transitionDuration: 0,
} as const;

let corePromise: Promise<EChartsCoreModule> | null = null;
let registrationPromise: Promise<void> | null = null;

async function loadEChartsCore(): Promise<EChartsCoreModule> {
  if (!corePromise) {
    corePromise = import("echarts/core");
  }
  const core = await corePromise;
  if (!registrationPromise) {
    registrationPromise = (async () => {
      const [charts, components, renderer] = await Promise.all([
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);

      const registrables: unknown[] = [
        charts.BarChart,
        charts.LineChart,
        charts.ScatterChart,
        components.GridComponent,
        components.DatasetComponent,
        components.TooltipComponent,
        components.VisualMapComponent,
        components.LegendComponent,
        renderer.CanvasRenderer,
      ].filter(Boolean);

      if (registrables.length > 0) {
        core.use(registrables as Parameters<EChartsCoreModule["use"]>[0]);
      }
    })();
  }
  await registrationPromise;
  return core;
}

function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): Throttled<TArgs> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;
  let lastInvoke = 0;

  const invoke = (args: TArgs) => {
    lastInvoke = Date.now();
    fn(...args);
  };

  const throttled = ((...args: TArgs) => {
    const now = Date.now();
    const remaining = wait - (now - lastInvoke);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      pendingArgs = null;
      invoke(args);
      return;
    }

    pendingArgs = args;
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        if (pendingArgs) {
          invoke(pendingArgs);
          pendingArgs = null;
        }
      }, remaining);
    }
  }) as Throttled<TArgs>;

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingArgs = null;
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

function emitEvent(
  instance: EChartsInstance,
  type: VizEvent["type"],
  meta?: Record<string, unknown>,
) {
  if (!instance.onEvent) {
    return;
  }

  const baseMeta = {
    lib: "echarts",
    motion: instance.discrete ? "discrete" : "animated",
  } satisfies Record<string, unknown>;

  instance.onEvent({
    type,
    ts: Date.now(),
    meta: meta ? { ...baseMeta, ...meta } : baseMeta,
  });
}

function applyDiscreteMotion(chart: EChartsInstanceType) {
  chart.setOption(DISCRETE_MOTION_OPTIONS as never, { notMerge: true } as never);
}

function setupResizeObserver(
  element: HTMLElement,
  chart: EChartsInstanceType,
  registerResizeObserver?: RegisterResizeObserver,
): (() => void) | null {
  const handler = throttle(() => {
    chart.resize();
  }, 150);

  if (registerResizeObserver) {
    const unregister = registerResizeObserver(() => handler());
    return () => {
      handler.cancel();
      unregister();
    };
  }

  if (typeof ResizeObserver === "undefined") {
    return null;
  }

  const observer = new ResizeObserver(() => handler());
  observer.observe(element);

  return () => {
    handler.cancel();
    observer.disconnect();
  };
}

function resolveMountOptions(opts: AdapterMountOptions): {
  discrete: boolean;
  onEvent: ((event: VizEvent) => void) | null;
  registerResizeObserver?: RegisterResizeObserver;
} {
  return {
    discrete: opts.discrete,
    onEvent: typeof opts.onEvent === "function" ? opts.onEvent : null,
    registerResizeObserver: opts.registerResizeObserver,
  };
}

function resolveApplyOptions(instance: EChartsInstance, opts: AdapterApplyOptions): boolean {
  if (typeof opts.onEvent === "function") {
    instance.onEvent = opts.onEvent;
  }
  return opts.discrete;
}

export const echartsAdapter: LegacyVizAdapter<EChartsInstance, EChartsOption> = {
  async mount(el, spec, opts) {
    const { discrete, onEvent, registerResizeObserver } = resolveMountOptions(opts);
    const core = await loadEChartsCore();
    const chart = core.init(el, undefined, { renderer: "canvas" });
    const clonedSpec = cloneSpec(spec);
    chart.setOption(clonedSpec, { notMerge: true, lazyUpdate: false } as never);
    if (discrete) {
      applyDiscreteMotion(chart);
    }
    const cleanupResizeObserver = setupResizeObserver(el, chart, registerResizeObserver);
    const instance: EChartsInstance = {
      element: el,
      chart,
      spec: clonedSpec,
      cleanupResizeObserver,
      onEvent,
      discrete,
    };
    emitEvent(instance, "viz_state", { reason: "mount" });
    return instance;
  },
  applyState(instance, next, opts) {
    const chart = instance.chart;
    const currentSpec = instance.spec;
    if (!chart || !currentSpec) {
      return;
    }

    const discrete = resolveApplyOptions(instance, opts);
    const previous = cloneSpec(currentSpec);
    const option = typeof next === "function" ? next(previous) : next;
    const cloned = cloneSpec(option);

    instance.spec = cloned;
    instance.discrete = discrete;

    chart.setOption(cloned, { notMerge: true } as never);
    if (discrete) {
      applyDiscreteMotion(chart);
    }
    emitEvent(instance, "viz_state", { reason: "spec" });
  },
  destroy(instance) {
    emitEvent(instance, "viz_state", { reason: "destroy" });
    instance.cleanupResizeObserver?.();
    instance.cleanupResizeObserver = null;
    instance.chart?.dispose();
    instance.chart = null;
    instance.element = null;
    instance.spec = null;
    instance.onEvent = null;
    instance.discrete = false;
  },
};

export type { EChartsInstance };
