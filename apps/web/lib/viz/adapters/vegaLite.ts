import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";

import type { VegaLiteSpec } from "../spec-types";
import type { VizAdapter, VizEvent } from "../types";

// Версионно-устойчивые типы: выводим из сигнатуры default-функции embed()
type VegaEmbedFn = (typeof import("vega-embed"))["default"];
type VisualizationSpec = Parameters<VegaEmbedFn>[1];
type EmbedOptions = NonNullable<Parameters<VegaEmbedFn>[2]>;
type VegaEmbedResult = Awaited<ReturnType<VegaEmbedFn>>;
type VegaView = NonNullable<VegaEmbedResult["view"]>;
type VegaSignalListener = Parameters<VegaView["addSignalListener"]>[1];

type VegaLiteState = { selection?: string };
type EmitEvent = (event: VizEvent) => void;

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
    config: {
      animation: animationConfig(discrete),
    },
  };
}

function normalizeSelectionValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) {
    return undefined;
  }
  return undefined;
}

function resolveSelectionSignal(spec: VegaLiteSpec): string | null {
  const usermeta = (spec as { usermeta?: unknown }).usermeta;
  if (isPlainObject(usermeta)) {
    const candidate = (usermeta as PlainObject).selectionSignal;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const params = (spec as { params?: unknown }).params;
  if (Array.isArray(params)) {
    for (const param of params) {
      if (!isPlainObject(param)) {
        continue;
      }
      const name = (param as PlainObject).name;
      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    }
  }

  const selection = (spec as { selection?: unknown }).selection;
  if (isPlainObject(selection)) {
    for (const [name, definition] of Object.entries(selection)) {
      if (!definition) {
        continue;
      }
      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    }
  }

  return null;
}

function emitEvent(
  onEvent: EmitEvent | undefined,
  type: VizEvent["type"],
  meta?: Record<string, unknown>,
): void {
  if (!onEvent) {
    return;
  }
  onEvent({
    type,
    ts: Date.now(),
    meta: { lib: "vega", ...(meta ?? {}) },
  });
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === "string") {
    return new Error(value);
  }
  return new Error("Unknown Vega-Lite error");
}

function clearElement(element: HTMLElement): void {
  if (typeof element.replaceChildren === "function") {
    element.replaceChildren();
    return;
  }
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export const vegaLiteAdapter: VizAdapter<VegaLiteState, VegaLiteSpec> = {
  async mount({ el, spec, initialState, discrete = false, onEvent, registerResizeObserver }) {
    if (!el) {
      throw new Error("Vega-Lite adapter requires a mount element");
    }
    if (!spec) {
      throw new Error("Vega-Lite adapter requires a specification");
    }

    emitEvent(onEvent, "viz_init", { discrete });

    if (typeof window === "undefined") {
      const error = new Error("Vega-Lite adapter is only available in the browser");
      emitEvent(onEvent, "viz_error", { reason: "environment", message: error.message });
      throw error;
    }

    let embedModule: typeof import("vega-embed");
    try {
      embedModule = await import("vega-embed");
    } catch (error) {
      emitEvent(onEvent, "viz_error", { reason: "import", message: toError(error).message });
      throw error;
    }

    const preparedSpec = prepareSpec(spec, { discrete });
    const options = buildEmbedOptions(discrete);

    let result: VegaEmbedResult;
    try {
      const embed = embedModule.default ?? embedModule;
      result = await embed(el, preparedSpec as unknown as VisualizationSpec, options);
    } catch (error) {
      emitEvent(onEvent, "viz_error", { reason: "mount", message: toError(error).message });
      throw error;
    }

    const view = result.view ?? null;
    const selectionSignal = resolveSelectionSignal(preparedSpec);
    let supportsSignal = Boolean(
      view &&
        selectionSignal &&
        typeof view.signal === "function" &&
        typeof view.addSignalListener === "function" &&
        typeof view.runAsync === "function",
    );

    const state: VegaLiteState = {};
    const initialSelection = initialState?.selection;
    let listenerTriggered = false;
    let removeSignalListener: (() => void) | null = null;

    const emitState = (meta?: Record<string, unknown>) => {
      emitEvent(onEvent, "viz_state", {
        selection: state.selection ?? null,
        discrete,
        ...(meta ?? {}),
      });
    };

    const emitError = (reason: string, error: unknown) => {
      emitEvent(onEvent, "viz_error", {
        reason,
        message: toError(error).message,
        discrete,
      });
    };

    if (supportsSignal && view && selectionSignal) {
      const listener: VegaSignalListener = (_name, value) => {
        listenerTriggered = true;
        const next = normalizeSelectionValue(value);
        if (state.selection === next) {
          return;
        }
        state.selection = next;
        emitState();
      };
      try {
        view.addSignalListener(selectionSignal, listener);
        removeSignalListener = () => {
          try {
            view.removeSignalListener(selectionSignal, listener);
          } catch {
            // ignore
          }
        };
      } catch {
        supportsSignal = false;
        removeSignalListener = null;
      }
    } else {
      supportsSignal = false;
    }

    const applySelection = async (value: string | undefined) => {
      if (!supportsSignal || !view || !selectionSignal) {
        if (state.selection !== value) {
          state.selection = value;
          emitState();
        }
        return;
      }

      const normalized = value ?? null;

      try {
        let current: unknown;
        try {
          current = view.signal(selectionSignal);
        } catch {
          current = undefined;
        }
        if (current === normalized) {
          if (state.selection !== value) {
            state.selection = value;
            emitState();
          }
          return;
        }
        listenerTriggered = false;
        view.signal(selectionSignal, normalized);
        await view.runAsync();
      } catch (error) {
        supportsSignal = false;
        emitError("signal", error);
        state.selection = value;
        emitState();
        throw error;
      } finally {
        if (!listenerTriggered) {
          if (state.selection !== value) {
            state.selection = value;
            emitState();
          }
        }
      }
    };

    const cleanupResize = registerResizeObserver
      ? registerResizeObserver(() => {
          if (!view) {
            return;
          }
          void view
            .resize()
            .runAsync()
            .catch((error: unknown) => {
              emitError("resize", error);
            });
        })
      : null;

    emitEvent(onEvent, "viz_ready", { discrete });

    if (typeof initialSelection !== "undefined") {
      try {
        await applySelection(initialSelection);
      } catch {
        // already reported
      }
    }

    const destroy = async () => {
      removeSignalListener?.();
      removeSignalListener = null;
      cleanupResize?.();
      if (view) {
        try {
          view.finalize?.();
        } catch (error) {
          emitError("finalize", error);
        }
      }
      clearElement(el);
      emitState({ reason: "destroy" });
    };

    return {
      async applyState(next) {
        if (!next) {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(next, "selection")) {
          try {
            await applySelection(next.selection);
          } catch {
            // error already emitted
          }
        }
      },
      destroy,
    };
  },
};
