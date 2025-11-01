// prettier-ignore
'use client';

import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";

import type { VegaLiteSpec } from "../spec-types";
import type {
  RegisterResizeObserver,
  VizAdapterWithConfig,
  VizEvent,
  VizInstance,
  VizLifecycleEvent,
} from "../types";

// Версионно-устойчивые типы: выводим из сигнатуры default-функции embed()
type VegaEmbedFn = (typeof import("vega-embed"))["default"];
type VisualizationSpec = Parameters<VegaEmbedFn>[1];
type EmbedOptions = NonNullable<Parameters<VegaEmbedFn>[2]>;
type VegaEmbedResult = Awaited<ReturnType<VegaEmbedFn>>;

type VegaLiteSelectionState = {
  selection?: string;
};

type EventSink = (event: VizLifecycleEvent) => void;

interface VegaLiteRuntime {
  element: HTMLElement | null;
  embed: typeof import("vega-embed") | null;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec | null;
  resizeCleanup: (() => void) | null;
  selectionSignal: string | null;
  onEvent: EventSink | null;
  state: VegaLiteSelectionState;
  selectionHandler: ((name: string, value: unknown) => void) | null;
  discrete: boolean;
}

export interface VegaLiteVizInstance extends VizInstance<VegaLiteSelectionState> {
  readonly result: VegaEmbedResult | null;
  readonly spec: VegaLiteSpec | null;
  readonly state: Readonly<VegaLiteSelectionState>;
  readonly selectionSignal: string | null;
  setSpec(
    next: VegaLiteSpec | ((prev: Readonly<VegaLiteSpec>) => VegaLiteSpec),
    options?: {
      readonly discrete?: boolean;
      readonly selectionSignal?: string | null;
      readonly state?: Readonly<VegaLiteSelectionState>;
    },
  ): Promise<void>;
}

type PlainObject = Record<string, unknown>;

type ViewWithSignals = VegaEmbedResult["view"] & {
  addSignalListener?: (signal: string, handler: (name: string, value: unknown) => void) => void;
  removeSignalListener?: (signal: string, handler: (name: string, value: unknown) => void) => void;
};

type SelectionState = {
  view: ViewWithSignals | null;
  signal: string | null;
  handler: ((name: string, value: unknown) => void) | null;
};

const SELECTION = new WeakMap<VegaLiteRuntime, SelectionState>();

const NOOP_SELECTION_HANDLER: (name: string, value: unknown) => void = () => {};

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

function emitEvent(
  instance: VegaLiteRuntime,
  type: VizEvent,
  meta?: Record<string, unknown>,
): void {
  if (!instance.onEvent) {
    return;
  }
  const base: Record<string, unknown> = {
    lib: "vega",
    motion: instance.discrete ? "discrete" : "animated",
  };
  const event: VizLifecycleEvent = {
    type,
    ts: Date.now(),
    meta: meta ? { ...base, ...meta } : base,
  };
  instance.onEvent(event);
}

function isPlainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Устойчивое извлечение категориальной палитры из токенов любой формы.
const CATEGORY_RANGE: readonly string[] = resolveCategoryRange(brandTokens as unknown);

// Дефолтная палитра (литерал можно пометить as const)
const DEFAULT_CATEGORY_RANGE = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#4b5563",
  "#16a34a",
] as const;

function resolveCategoryRange(tokens: unknown): readonly string[] {
  // Кандидатные пути до категориальных цветов (индексированные "1","2",…)
  const candidates: (readonly (string | number)[])[] = [
    ["dataviz", "series"],
    ["dataviz", "palette", "category"],
    ["colors", "series"],
    ["color", "series"],
    ["dataviz", "colors", "category"],
    ["palette", "category"],
  ];
  const get = (value: unknown, path: readonly (string | number)[]) =>
    path.reduce<unknown>((current, key) => {
      if (!isPlainObject(current)) {
        return undefined;
      }
      return current[key as keyof PlainObject];
    }, value);
  const takeIndexed = (value: unknown, max = 12): string[] => {
    if (!isPlainObject(value)) {
      return [];
    }
    const source = value;
    const out: string[] = [];
    for (let i = 1; i <= max; i++) {
      const entry = source[String(i)];
      if (typeof entry === "string") {
        out.push(entry);
        continue;
      }
      if (isPlainObject(entry)) {
        const direct = entry.value;
        if (typeof direct === "string") {
          out.push(direct);
          continue;
        }
        const mid = entry["500"];
        if (typeof mid === "string") {
          out.push(mid);
        }
      }
    }
    return out;
  };
  for (const path of candidates) {
    const obj = get(tokens, path);
    const colors = takeIndexed(obj, 12).filter(Boolean);
    if (colors.length >= 4) return colors as readonly string[];
  }
  // Fallback: первый найденный набор hex-значений (до 8 штук)
  const hexes: string[] = [];
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const scan = (value: unknown) => {
    if (!isPlainObject(value) || hexes.length >= 8) {
      return;
    }
    for (const nested of Object.values(value)) {
      if (hexes.length >= 8) {
        break;
      }
      if (typeof nested === "string" && HEX.test(nested)) {
        hexes.push(nested);
        continue;
      }
      if (isPlainObject(nested)) {
        const direct = nested.value;
        if (typeof direct === "string" && HEX.test(direct)) {
          hexes.push(direct);
          continue;
        }
        scan(nested);
      }
    }
  };
  scan(tokens);
  if (hexes.length) {
    return hexes.slice(0, 8);
  }
  return DEFAULT_CATEGORY_RANGE;
}

const BASE_THEME_CONFIG: VegaLiteSpec["config"] = {
  background: tokens.color.bg.canvas,
  font: tokens.font.family.sans,
  axis: {
    labelColor: tokens.color.fg.subtle,
    labelFont: tokens.font.family.sans,
    titleColor: tokens.color.fg.default,
    titleFont: tokens.font.family.sans,
    tickColor: tokens.color.border.subtle,
    domainColor: tokens.color.border.subtle,
    gridColor: tokens.color.border.subtle,
  },
  legend: {
    labelColor: tokens.color.fg.subtle,
    titleColor: tokens.color.fg.default,
    titleFont: tokens.font.family.sans,
    labelFont: tokens.font.family.sans,
  },
  title: {
    color: tokens.color.fg.default,
    font: tokens.font.family.sans,
  },
  view: {
    stroke: tokens.color.border.subtle,
    fill: tokens.color.bg.canvas,
  },
  range: {
    category: [...CATEGORY_RANGE],
  },
};

function cloneValues(values: unknown): unknown {
  if (!Array.isArray(values)) {
    return values;
  }
  return values.slice();
}

function cloneData(data: VegaLiteSpec["data"]): VegaLiteSpec["data"] {
  if (!data) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.slice() as typeof data;
  }
  if (typeof data === "object" && isPlainObject(data)) {
    const copy = { ...(data as PlainObject) } as typeof data;
    if ("values" in copy && Array.isArray((copy as PlainObject).values)) {
      (copy as PlainObject).values = cloneValues((copy as PlainObject).values);
    }
    return copy;
  }
  return data;
}

function cloneDatasets(
  datasets: NonNullable<VegaLiteSpec["datasets"]>,
): NonNullable<VegaLiteSpec["datasets"]> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(datasets)) {
    if (Array.isArray(value)) {
      clone[key] = value.slice();
      continue;
    }
    if (typeof value === "object" && value !== null && isPlainObject(value)) {
      const entry = { ...(value as PlainObject) };
      if ("values" in entry && Array.isArray(entry.values)) {
        entry.values = cloneValues(entry.values);
      }
      clone[key] = entry;
      continue;
    }
    clone[key] = value;
  }
  return clone as NonNullable<VegaLiteSpec["datasets"]>;
}

function cloneSpec(spec: VegaLiteSpec): VegaLiteSpec {
  const clone = { ...(spec as unknown as PlainObject) } as unknown as VegaLiteSpec;
  if ("data" in spec && spec.data !== undefined) {
    clone.data = cloneData(spec.data);
  }
  if (spec.datasets) {
    clone.datasets = cloneDatasets(spec.datasets);
  }
  return clone;
}

function mergeConfigs(
  theme: VegaLiteSpec["config"] | undefined,
  override: VegaLiteSpec["config"] | undefined,
): VegaLiteSpec["config"] | undefined {
  if (!theme && !override) {
    return undefined;
  }
  if (!override) {
    return theme ? JSON.parse(JSON.stringify(theme)) : undefined;
  }
  if (!theme) {
    return JSON.parse(JSON.stringify(override));
  }

  const mergeObject = (base: PlainObject, extra: PlainObject): PlainObject => {
    const result: PlainObject = { ...base };
    for (const [key, value] of Object.entries(extra)) {
      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = mergeObject(result[key] as PlainObject, value);
        continue;
      }
      result[key] = Array.isArray(value) ? [...value] : value;
    }
    return result;
  };

  return mergeObject(
    theme as unknown as PlainObject,
    override as unknown as PlainObject,
  ) as VegaLiteSpec["config"];
}

function removeTransitions<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((item) => removeTransitions(item)) as unknown as TValue;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const result: PlainObject = {};
  for (const [key, inner] of Object.entries(value as PlainObject)) {
    if (key === "transition") {
      continue;
    }
    if (key === "encode" && isPlainObject(inner)) {
      const encode: PlainObject = {};
      for (const [phase, definition] of Object.entries(inner as PlainObject)) {
        if (phase === "update") {
          continue;
        }
        encode[phase] = removeTransitions(definition);
      }
      if (Object.keys(encode).length > 0) {
        result[key] = encode;
      }
      continue;
    }
    result[key] = removeTransitions(inner);
  }
  return result as TValue;
}

function prepareSpec(spec: VegaLiteSpec, opts: { discrete: boolean }): VegaLiteSpec {
  const clone = cloneSpec(spec);
  const themeConfig = mergeConfigs(BASE_THEME_CONFIG, clone.config);
  if (themeConfig) {
    clone.config = themeConfig;
  }
  if (clone.background === undefined) {
    clone.background = tokens.color.bg.canvas;
  }
  if (opts.discrete) {
    return removeTransitions(clone);
  }
  return clone;
}

function withAutosize(spec: VegaLiteSpec): VegaLiteSpec {
  const baseAutosize = {
    type: "fit" as const,
    contains: "padding" as const,
    resize: true,
  };

  const nextAutosize =
    spec.autosize && typeof spec.autosize === "object"
      ? { ...baseAutosize, ...spec.autosize }
      : baseAutosize;

  return {
    ...spec,
    autosize: nextAutosize,
  };
}

function cloneSelectionState(
  state: Readonly<VegaLiteSelectionState> | undefined,
): VegaLiteSelectionState {
  if (!state) {
    return {};
  }

  const clone: VegaLiteSelectionState = {};
  if (state.selection !== undefined) {
    clone.selection = state.selection;
  }
  return clone;
}

function resolveSelectionSignal(spec: VegaLiteSpec | null | undefined): string | null {
  if (!spec || typeof spec !== "object") {
    return null;
  }

  const usermeta = (spec as { usermeta?: unknown }).usermeta;
  if (usermeta && typeof usermeta === "object") {
    const meta = usermeta as Record<string, unknown>;
    const direct = meta.selectionSignal;
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }
    const nested = meta.viz;
    if (nested && typeof nested === "object") {
      const nestedSignal = (nested as Record<string, unknown>).selectionSignal;
      if (typeof nestedSignal === "string" && nestedSignal.trim()) {
        return nestedSignal;
      }
    }
  }

  const selection = (spec as { selection?: unknown }).selection;
  if (selection && typeof selection === "object") {
    const keys = Object.keys(selection as Record<string, unknown>);
    if (keys.length > 0) {
      return keys[0] ?? null;
    }
  }

  const params = (spec as { params?: unknown }).params;
  if (Array.isArray(params)) {
    for (const param of params) {
      if (param && typeof param === "object") {
        const name = (param as { name?: unknown }).name;
        const hasSelect = Object.prototype.hasOwnProperty.call(
          param as Record<string, unknown>,
          "select",
        );
        if (hasSelect && typeof name === "string" && name.trim()) {
          return name;
        }
      }
    }
  }

  return null;
}

function toSelectionString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function detachSelectionListener(inst: VegaLiteRuntime): void {
  const state = SELECTION.get(inst);
  if (state?.view && state.signal && state.handler && state.view.removeSignalListener) {
    try {
      state.view.removeSignalListener(state.signal, state.handler);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[vega-lite] Failed to detach selection listener", error);
      }
    }
  }
  SELECTION.set(inst, { view: state?.view ?? null, signal: null, handler: null });
}

function attachSelectionListener(
  inst: VegaLiteRuntime,
  view: ViewWithSignals,
  signal: string,
  onSelection: (name: string, value: unknown) => void,
): void {
  detachSelectionListener(inst);
  if (view.addSignalListener) {
    try {
      view.addSignalListener(signal, onSelection);
      SELECTION.set(inst, { view, signal, handler: onSelection });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[vega-lite] Failed to attach selection listener", error);
      }
      SELECTION.set(inst, { view, signal: null, handler: null });
    }
  } else {
    SELECTION.set(inst, { view, signal: null, handler: null });
  }
}

function ensureSelectionListener(
  inst: VegaLiteRuntime,
  view: ViewWithSignals | null,
  nextSignal: string | null | undefined,
  onSelection: (name: string, value: unknown) => void,
): void {
  const state = SELECTION.get(inst) ?? { view: null, signal: null, handler: null };
  const want = Boolean(nextSignal);
  const have = Boolean(state.view) && Boolean(state.signal) && Boolean(state.handler);

  if (!view) {
    if (have) {
      detachSelectionListener(inst);
    }
    SELECTION.set(inst, { view: null, signal: null, handler: null });
    return;
  }

  if (!want) {
    if (have) {
      detachSelectionListener(inst);
    }
    SELECTION.set(inst, { view, signal: null, handler: null });
    return;
  }

  if (!have || state.signal !== nextSignal || state.view !== view) {
    attachSelectionListener(inst, view, nextSignal!, onSelection);
    return;
  }

  if (state.view !== view) {
    SELECTION.set(inst, { view, signal: state.signal, handler: state.handler });
  }
}

async function applySelectionStateToView(instance: VegaLiteRuntime): Promise<void> {
  const signal = instance.selectionSignal;
  const view = instance.result?.view;
  if (!signal || !view || typeof view.signal !== "function") {
    return;
  }

  try {
    view.signal(signal, instance.state.selection ?? null);
    if (typeof view.runAsync === "function") {
      await view.runAsync();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[vega-lite] Failed to sync selection state", error);
    }
    emitEvent(instance, "viz_error", {
      reason: "apply_state",
      error: toErrorMessage(error),
      signal,
    });
  }
}

async function waitForAnimationFrame(): Promise<void> {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function settleLayout(): Promise<void> {
  await waitForAnimationFrame();
  await waitForAnimationFrame();
}

async function runViewResize(view: VegaEmbedResult["view"] | undefined | null): Promise<void> {
  if (!view || typeof view.resize !== "function") {
    return;
  }

  try {
    const resized = view.resize();
    if (resized && typeof resized.runAsync === "function") {
      await resized.runAsync();
      return;
    }
    if (typeof view.runAsync === "function") {
      await view.runAsync();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[vega-lite] Failed to run resize", error);
    }
  }
}

function attachResizeHandling(
  instance: VegaLiteRuntime,
  element: HTMLElement,
  registerResizeObserver?: RegisterResizeObserver,
): (() => void) | null {
  const handler = () => {
    const view = instance.result?.view;
    void runViewResize(view);
  };

  if (registerResizeObserver) {
    return registerResizeObserver(() => {
      handler();
    });
  }

  const listener = () => {
    handler();
  };
  element.addEventListener("viz_resized", listener as EventListener);
  return () => {
    element.removeEventListener("viz_resized", listener as EventListener);
  };
}

function animationConfig(discrete: boolean) {
  if (discrete) {
    return { duration: 0, easing: "linear" };
  }
  const config: { duration?: number; easing?: string } = {
    easing: tokens.motion.easing.standard,
  };
  const duration = Number.parseInt(tokens.motion.duration.fast, 10);
  if (Number.isFinite(duration)) {
    config.duration = duration;
  }
  return config;
}

function buildEmbedOptions(discrete: boolean): EmbedOptions {
  return {
    actions: false,
    renderer: "canvas",
    mode: "vega-lite",
    config: {
      animation: animationConfig(discrete),
    },
  };
}

interface RenderOptions {
  readonly discrete: boolean;
  readonly state?: Readonly<VegaLiteSelectionState>;
  readonly selectionSignal?: string | null;
}

async function render(
  instance: VegaLiteRuntime,
  spec: VegaLiteSpec,
  options: RenderOptions,
): Promise<VegaEmbedResult | null> {
  const embedModule = instance.embed;
  const element = instance.element;
  if (!embedModule || !element) {
    instance.spec = spec;
    if (options.state !== undefined) {
      instance.state = cloneSelectionState(options.state);
    }
    if (options.selectionSignal !== undefined) {
      instance.selectionSignal = options.selectionSignal ?? null;
    }
    return instance.result;
  }
  const embed = embedModule.default ?? embedModule;
  const preparedSpec: VegaLiteSpec = withAutosize(
    prepareSpec(spec, { discrete: options.discrete }),
  );
  const embedOptions = buildEmbedOptions(options.discrete);
  detachSelectionListener(instance);
  const result = await embed(element, preparedSpec as unknown as VisualizationSpec, embedOptions);
  instance.result?.view?.finalize?.();
  instance.result = result;
  instance.spec = preparedSpec;
  const nextState =
    options.state !== undefined ? cloneSelectionState(options.state) : { ...instance.state };
  instance.state = nextState;
  const resolvedSignal =
    options.selectionSignal !== undefined
      ? options.selectionSignal
      : resolveSelectionSignal(preparedSpec);
  instance.selectionSignal = resolvedSignal ?? null;
  await settleLayout();
  await runViewResize(result.view);
  await applySelectionStateToView(instance);
  return result;
}

export const vegaLiteAdapter: VizAdapterWithConfig<VegaLiteSelectionState, VegaLiteSpec> = {
  async mount({ el, spec, initialState, discrete = false, onEvent, registerResizeObserver }) {
    if (!spec) {
      throw new Error("Vega-Lite adapter requires a specification.");
    }

    const [embedModule] = await Promise.all([
      import("vega-embed"),
      import("vega"),
      import("vega-lite"),
      import("react-vega"),
    ]);

    const runtime: VegaLiteRuntime = {
      element: el,
      embed: embedModule,
      result: null,
      spec: null,
      resizeCleanup: null,
      selectionSignal: resolveSelectionSignal(spec),
      onEvent: onEvent ?? null,
      state: cloneSelectionState(initialState),
      selectionHandler: null,
      discrete,
    };

    const onSelection = (name: string, value: unknown) => {
      const selectionValue = toSelectionString(value);
      const nextState: VegaLiteSelectionState = { ...runtime.state };
      if (selectionValue === undefined) {
        delete nextState.selection;
      } else {
        nextState.selection = selectionValue;
      }
      runtime.state = nextState;
      emitEvent(runtime, "viz_state", {
        reason: "selection",
        signal: name ?? runtime.selectionSignal,
        selection: selectionValue ?? null,
      });
    };

    runtime.selectionHandler = onSelection;
    SELECTION.set(runtime, { view: null, signal: null, handler: null });

    emitEvent(runtime, "viz_init", { reason: "mount" });

    try {
      const embedResult = await render(runtime, spec, {
        discrete: runtime.discrete,
        state: runtime.state,
        selectionSignal: runtime.selectionSignal,
      });

      const view = embedResult?.view ?? runtime.result?.view ?? null;
      ensureSelectionListener(
        runtime,
        view,
        runtime.selectionSignal,
        runtime.selectionHandler ?? NOOP_SELECTION_HANDLER,
      );

      runtime.resizeCleanup = attachResizeHandling(runtime, el, registerResizeObserver);

      emitEvent(runtime, "viz_ready", { reason: "mount" });

      const instance: VegaLiteVizInstance = {
        async applyState(next) {
          if (!next || typeof next !== "object") {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(next, "selection")) {
            const selectionValue = toSelectionString((next as VegaLiteSelectionState).selection);
            const updated: VegaLiteSelectionState = { ...runtime.state };
            if (selectionValue === undefined) {
              delete updated.selection;
            } else {
              updated.selection = selectionValue;
            }
            runtime.state = updated;
            await applySelectionStateToView(runtime);
            emitEvent(runtime, "viz_state", {
              reason: "selection",
              signal: runtime.selectionSignal,
              selection: selectionValue ?? null,
            });
          }
        },
        async setSpec(nextSpec, options = {}) {
          const base = runtime.spec ? cloneSpec(runtime.spec) : cloneSpec(spec);
          const candidate =
            typeof nextSpec === "function" ? nextSpec(base as Readonly<VegaLiteSpec>) : nextSpec;
          const discreteOverride = options.discrete;
          if (typeof discreteOverride === "boolean") {
            runtime.discrete = discreteOverride;
          }
          const nextState = options.state ?? runtime.state;
          try {
            await render(runtime, candidate, {
              discrete: runtime.discrete,
              state: nextState,
              selectionSignal:
                options.selectionSignal !== undefined
                  ? options.selectionSignal
                  : resolveSelectionSignal(candidate),
            });
            const viewAfter = runtime.result?.view ?? null;
            ensureSelectionListener(
              runtime,
              viewAfter,
              runtime.selectionSignal,
              runtime.selectionHandler ?? NOOP_SELECTION_HANDLER,
            );
            emitEvent(runtime, "viz_state", { reason: "spec" });
          } catch (error) {
            emitEvent(runtime, "viz_error", {
              reason: "spec",
              error: toErrorMessage(error),
            });
            throw error;
          }
        },
        async destroy() {
          try {
            detachSelectionListener(runtime);
            SELECTION.delete(runtime);
            runtime.result?.view?.finalize?.();
            runtime.resizeCleanup?.();
          } finally {
            emitEvent(runtime, "viz_state", { reason: "destroy" });
            runtime.resizeCleanup = null;
            runtime.result = null;
            runtime.spec = null;
            runtime.element = null;
            runtime.embed = null;
            runtime.selectionHandler = null;
            runtime.selectionSignal = null;
            runtime.state = {};
            runtime.onEvent = null;
          }
        },
        get result() {
          return runtime.result;
        },
        get spec() {
          return runtime.spec ? cloneSpec(runtime.spec) : null;
        },
        get state() {
          return { ...runtime.state };
        },
        get selectionSignal() {
          return runtime.selectionSignal;
        },
      };

      return instance;
    } catch (error) {
      emitEvent(runtime, "viz_error", {
        reason: "mount",
        error: toErrorMessage(error),
      });
      throw error;
    }
  },
};
