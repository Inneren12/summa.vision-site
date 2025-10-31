"use client";

import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";

import type { VegaLiteSpec } from "../spec-types";
import type { LegacyVizAdapter } from "../types";

// Версионно-устойчивые типы: выводим из сигнатуры default-функции embed()
type VegaEmbedFn = (typeof import("vega-embed"))["default"];
type VisualizationSpec = Parameters<VegaEmbedFn>[1];
type EmbedOptions = NonNullable<Parameters<VegaEmbedFn>[2]>;
type VegaEmbedResult = Awaited<ReturnType<VegaEmbedFn>>;

type VegaLiteSelectionState = {
  selection?: string;
};

type StateEmitter = (type: string, payload: unknown, meta?: Record<string, unknown>) => void;

interface VegaLiteInstance {
  element: HTMLElement | null;
  embed: typeof import("vega-embed") | null;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec | null;
  resizeListener: ((event: Event) => void) | null;
  selectionSignal: string | null;
  signalListener: ((name: string, value: unknown) => void) | null;
  emitState: StateEmitter | null;
  stateCache: VegaLiteSelectionState;
}

interface VegaLiteMountOptions {
  readonly discrete: boolean;
  readonly state?: Readonly<VegaLiteSelectionState>;
  readonly selectionSignal?: string | null;
  readonly emit?: StateEmitter | null;
}

type PlainObject = Record<string, unknown>;

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

function coerceSelectionValue(value: unknown): string | undefined {
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

function isSelectionStateUpdate(value: unknown): value is Partial<VegaLiteSelectionState> {
  if (!isPlainObject(value)) {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(value, "selection")) {
    return false;
  }
  const selection = (value as PlainObject).selection;
  return (
    selection === undefined ||
    selection === null ||
    typeof selection === "string" ||
    typeof selection === "number" ||
    typeof selection === "boolean"
  );
}

function detachSelectionListener(instance: VegaLiteInstance): void {
  const signal = instance.selectionSignal;
  const listener = instance.signalListener;
  const view = instance.result?.view;
  if (!signal || !listener || !view || typeof view.removeSignalListener !== "function") {
    instance.signalListener = null;
    return;
  }
  try {
    view.removeSignalListener(signal, listener);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[vega-lite] Failed to detach selection listener", error);
    }
  }
  instance.signalListener = null;
}

function attachSelectionListener(instance: VegaLiteInstance): void {
  const signal = instance.selectionSignal;
  const view = instance.result?.view;
  if (!signal || !view || typeof view.addSignalListener !== "function") {
    return;
  }

  detachSelectionListener(instance);

  const listener = (_name: string, value: unknown) => {
    const selectionValue = coerceSelectionValue(value);
    const nextState: VegaLiteSelectionState = { ...instance.stateCache };
    if (selectionValue === undefined) {
      delete nextState.selection;
    } else {
      nextState.selection = selectionValue;
    }
    instance.stateCache = nextState;
    instance.emitState?.("state", selectionValue, { signal });
  };

  try {
    view.addSignalListener(signal, listener);
    instance.signalListener = listener;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[vega-lite] Failed to attach selection listener", error);
    }
  }
}

async function applySelectionStateToView(instance: VegaLiteInstance): Promise<void> {
  const signal = instance.selectionSignal;
  const view = instance.result?.view;
  if (!signal || !view || typeof view.signal !== "function") {
    return;
  }

  try {
    view.signal(signal, instance.stateCache.selection ?? null);
    if (typeof view.runAsync === "function") {
      await view.runAsync();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[vega-lite] Failed to sync selection state", error);
    }
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

function createResizeListener(instance: VegaLiteInstance) {
  return () => {
    const view = instance.result?.view;
    void runViewResize(view);
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

async function render(
  instance: VegaLiteInstance,
  spec: VegaLiteSpec,
  options: VegaLiteMountOptions,
): Promise<VegaEmbedResult | null> {
  const embedModule = instance.embed;
  const element = instance.element;
  if (!embedModule || !element) {
    instance.spec = spec;
    if (options.state !== undefined) {
      instance.stateCache = cloneSelectionState(options.state);
    }
    if (options.selectionSignal !== undefined) {
      instance.selectionSignal = options.selectionSignal ?? null;
    }
    if (options.emit !== undefined) {
      instance.emitState = options.emit ?? null;
    }
    return instance.result;
  }
  const embed = embedModule.default ?? embedModule;
  const preparedSpec = withAutosize(prepareSpec(spec, { discrete: options.discrete }));
  const embedOptions = buildEmbedOptions(options.discrete);
  detachSelectionListener(instance);
  const result = await embed(element, preparedSpec as unknown as VisualizationSpec, embedOptions);
  instance.result?.view?.finalize?.();
  instance.result = result;
  instance.spec = preparedSpec;
  const nextState =
    options.state !== undefined ? cloneSelectionState(options.state) : { ...instance.stateCache };
  instance.stateCache = nextState;
  if (options.selectionSignal !== undefined) {
    instance.selectionSignal = options.selectionSignal ?? null;
  }
  if (options.emit !== undefined) {
    instance.emitState = options.emit ?? null;
  }
  await settleLayout();
  await runViewResize(result.view);
  attachSelectionListener(instance);
  await applySelectionStateToView(instance);
  return result;
}

export const vegaLiteAdapter: LegacyVizAdapter<VegaLiteInstance, VegaLiteSpec> = {
  async mount(el, spec, opts: VegaLiteMountOptions) {
    const embed = await import("vega-embed");
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec: null,
      resizeListener: null,
      selectionSignal: opts.selectionSignal ?? null,
      signalListener: null,
      emitState: opts.emit ?? null,
      stateCache: cloneSelectionState(opts.state),
    };
    await render(instance, spec, {
      discrete: opts.discrete,
      state: instance.stateCache,
      selectionSignal: instance.selectionSignal,
      emit: instance.emitState,
    });
    if (!instance.resizeListener) {
      const listener = createResizeListener(instance);
      el.addEventListener("viz_resized", listener as EventListener);
      instance.resizeListener = listener;
    }
    return instance;
  },
  applyState(instance, next, opts: VegaLiteMountOptions) {
    const selectionSignal = opts.selectionSignal ?? instance.selectionSignal;
    if (selectionSignal && isSelectionStateUpdate(next)) {
      const selectionValue = coerceSelectionValue(
        (next as Partial<VegaLiteSelectionState>).selection,
      );
      const updated: VegaLiteSelectionState = { ...instance.stateCache };
      if (selectionValue === undefined) {
        delete updated.selection;
      } else {
        updated.selection = selectionValue;
      }
      instance.stateCache = updated;
      if (opts.selectionSignal !== undefined) {
        instance.selectionSignal = opts.selectionSignal ?? null;
      } else {
        instance.selectionSignal = selectionSignal;
      }
      if (opts.emit !== undefined) {
        instance.emitState = opts.emit ?? null;
      }
      void applySelectionStateToView(instance);
      return;
    }

    const currentSpec = instance.spec;
    if (!currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const spec = typeof next === "function" ? next(previous) : next;
    void render(instance, spec, {
      discrete: opts.discrete,
      state: instance.stateCache,
      selectionSignal: opts.selectionSignal ?? instance.selectionSignal,
      emit: opts.emit ?? instance.emitState,
    });
  },
  destroy(instance) {
    detachSelectionListener(instance);
    instance.result?.view?.finalize?.();
    instance.result = null;
    if (instance.element && instance.resizeListener) {
      instance.element.removeEventListener("viz_resized", instance.resizeListener as EventListener);
    }
    instance.element = null;
    instance.embed = null;
    instance.spec = null;
    instance.resizeListener = null;
    instance.selectionSignal = null;
    instance.signalListener = null;
    instance.emitState = null;
    instance.stateCache = {};
  },
};
