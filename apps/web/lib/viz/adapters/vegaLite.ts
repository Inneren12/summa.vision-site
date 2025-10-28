import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";

import type { VegaLiteSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type VisualizationSpec = import("vega-embed").VisualizationSpec;
type EmbedOptions = import("vega-embed").EmbedOptions;

type VegaEmbedResult = import("vega-embed").Result;

interface VegaLiteInstance {
  element: HTMLElement | null;
  embed: typeof import("vega-embed") | null;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec | null;
}

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const CATEGORY_RANGE: readonly string[] = [
  brandTokens.dataviz?.series?.["1"]?.value ?? "#2563eb",
  brandTokens.dataviz?.series?.["2"]?.value ?? "#dc2626",
  brandTokens.dataviz?.series?.["3"]?.value ?? "#059669",
  brandTokens.dataviz?.series?.["4"]?.value ?? "#d97706",
  brandTokens.dataviz?.series?.["5"]?.value ?? "#7c3aed",
  brandTokens.dataviz?.series?.["6"]?.value ?? "#0ea5e9",
  brandTokens.dataviz?.series?.["7"]?.value ?? "#f59e0b",
  brandTokens.dataviz?.series?.["8"]?.value ?? "#16a34a",
  brandTokens.dataviz?.series?.["9"]?.value ?? "#ea580c",
  brandTokens.dataviz?.series?.["10"]?.value ?? "#db2777",
  brandTokens.dataviz?.series?.["11"]?.value ?? "#1d4ed8",
  brandTokens.dataviz?.series?.["12"]?.value ?? "#14b8a6",
] as const;

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
  const clone = { ...(spec as PlainObject) } as VegaLiteSpec;
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

  return mergeObject(theme as PlainObject, override as PlainObject) as VegaLiteSpec["config"];
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

async function render(
  instance: VegaLiteInstance,
  spec: VegaLiteSpec,
  discrete: boolean,
): Promise<VegaEmbedResult | null> {
  const embedModule = instance.embed;
  const element = instance.element;
  if (!embedModule || !element) {
    instance.spec = spec;
    return instance.result;
  }
  const embed = embedModule.default ?? embedModule;
  const preparedSpec = prepareSpec(spec, { discrete });
  const options = buildEmbedOptions(discrete);
  const result = await embed(element, preparedSpec as VisualizationSpec, options);
  instance.result?.view?.finalize?.();
  instance.result = result;
  instance.spec = preparedSpec;
  return result;
}

export const vegaLiteAdapter: VizAdapter<VegaLiteInstance, VegaLiteSpec> = {
  async mount(el, spec, opts) {
    const embed = await import("vega-embed");
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec: null,
    };
    await render(instance, spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const currentSpec = instance.spec;
    if (!currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const spec = typeof next === "function" ? next(previous) : next;
    void render(instance, spec, opts.discrete);
  },
  destroy(instance) {
    instance.result?.view?.finalize?.();
    instance.result = null;
    instance.element = null;
    instance.embed = null;
    instance.spec = null;
  },
};
