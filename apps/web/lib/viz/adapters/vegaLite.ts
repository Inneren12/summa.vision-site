import type { VegaLiteSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type VegaEmbedModule = typeof import("vega-embed");
type VisualizationSpec = import("vega-embed").VisualizationSpec;

interface VegaEmbedResult {
  view?: {
    finalize?: () => void;
  };
}

interface VegaLiteInstance {
  element: HTMLElement;
  embed: VegaEmbedModule;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec;
}

interface VariableContext {
  readonly element: CSSStyleDeclaration;
  readonly root: CSSStyleDeclaration | null;
}

function createVariableContext(element: HTMLElement): VariableContext | null {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return null;
  }

  const elementStyle = window.getComputedStyle(element);
  const rootElement = element.ownerDocument?.documentElement;
  const rootStyle =
    rootElement && rootElement !== element ? window.getComputedStyle(rootElement) : null;

  return { element: elementStyle, root: rootStyle } satisfies VariableContext;
}

function readVariable(context: VariableContext | null, name: string): string | null {
  if (!context) {
    return null;
  }

  const value = context.element.getPropertyValue(name);
  if (value && value.trim()) {
    return value.trim();
  }

  if (context.root) {
    const rootValue = context.root.getPropertyValue(name);
    if (rootValue && rootValue.trim()) {
      return rootValue.trim();
    }
  }

  return null;
}

function assignIfMissing(
  target: Record<string, unknown>,
  key: string,
  value: string | ReadonlyArray<string> | null | undefined,
): boolean {
  if (value == null) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(target, key) && target[key] != null) {
    return false;
  }

  target[key] = value as never;
  return true;
}

function cloneInlineData(source: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...source };
  if (Array.isArray(next.values)) {
    next.values = next.values.slice();
  }
  return next;
}

function cloneData(data: VegaLiteSpec["data"]): VegaLiteSpec["data"] {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === "object" ? cloneInlineData(item as Record<string, unknown>) : item,
    );
  }

  if (typeof data === "object") {
    return cloneInlineData(data as Record<string, unknown>);
  }

  return data;
}

function cloneDatasets(datasets: VegaLiteSpec["datasets"]): VegaLiteSpec["datasets"] {
  if (!datasets || typeof datasets !== "object") {
    return datasets;
  }

  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(datasets as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      cloned[key] = value.slice();
      continue;
    }

    if (value && typeof value === "object") {
      cloned[key] = { ...(value as Record<string, unknown>) };
      continue;
    }

    cloned[key] = value;
  }

  return cloned as VegaLiteSpec["datasets"];
}

function cloneSpec(spec: VegaLiteSpec): VegaLiteSpec {
  const clone = { ...(spec as Record<string, unknown>) } as VegaLiteSpec;
  if (spec.data) {
    clone.data = cloneData(spec.data);
  }
  if (spec.datasets) {
    clone.datasets = cloneDatasets(spec.datasets);
  }
  if (spec.transform) {
    clone.transform = spec.transform.map((item) =>
      item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : item,
    );
  }
  if (spec.params) {
    clone.params = spec.params.map((item) =>
      item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : item,
    );
  }
  if (Array.isArray((spec as { layer?: VegaLiteSpec[] }).layer)) {
    clone.layer = (spec as { layer: VegaLiteSpec[] }).layer.map((entry) => cloneSpec(entry));
  }
  if (Array.isArray((spec as { hconcat?: VegaLiteSpec[] }).hconcat)) {
    clone.hconcat = (spec as { hconcat: VegaLiteSpec[] }).hconcat.map((entry) => cloneSpec(entry));
  }
  if (Array.isArray((spec as { vconcat?: VegaLiteSpec[] }).vconcat)) {
    clone.vconcat = (spec as { vconcat: VegaLiteSpec[] }).vconcat.map((entry) => cloneSpec(entry));
  }
  if (Array.isArray((spec as { concat?: VegaLiteSpec[] }).concat)) {
    clone.concat = (spec as { concat: VegaLiteSpec[] }).concat.map((entry) => cloneSpec(entry));
  }
  return clone;
}

function cloneForRender(spec: VegaLiteSpec): VegaLiteSpec {
  return { ...(spec as Record<string, unknown>) } as VegaLiteSpec;
}

function animationConfig(discrete: boolean) {
  if (!discrete) {
    return undefined;
  }
  return {
    duration: 0,
    easing: "linear",
  } as const;
}

function buildPalette(context: VariableContext | null): ReadonlyArray<string> {
  const paletteVariables = [
    "--color-accent-teal",
    "--color-accent-violet",
    "--color-accent-orange",
    "--color-accent-magenta",
    "--color-accent-yellow",
    "--color-status-info",
    "--color-status-ok",
    "--color-status-warn",
    "--color-status-alert",
  ];

  const seen = new Set<string>();
  const palette: string[] = [];

  for (const name of paletteVariables) {
    const value = readVariable(context, name);
    if (value && !seen.has(value)) {
      seen.add(value);
      palette.push(value);
    }
  }

  return palette;
}

function applyTokenTheme(spec: VegaLiteSpec, element: HTMLElement): VegaLiteSpec {
  const context = createVariableContext(element);
  const background = readVariable(context, "--color-bg-canvas");
  const fontFamily = readVariable(context, "--font-family-sans");
  const textColor = readVariable(context, "--color-fg-default");
  const mutedColor = readVariable(context, "--color-fg-muted") ?? textColor;
  const borderColor = readVariable(context, "--color-border-subtle") ?? mutedColor ?? textColor;

  if (!spec.background && background) {
    spec.background = background;
  }

  if (!context) {
    return spec;
  }

  const config = { ...(spec.config as Record<string, unknown> | undefined) };
  let configChanged = false;

  if (fontFamily && !config.font) {
    config.font = fontFamily;
    configChanged = true;
  }

  const axisConfig = { ...(config.axis as Record<string, unknown> | undefined) };
  let axisChanged = false;
  axisChanged = assignIfMissing(axisConfig, "labelFont", fontFamily) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "titleFont", fontFamily) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "labelColor", mutedColor) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "titleColor", textColor) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "gridColor", borderColor) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "tickColor", borderColor) || axisChanged;
  axisChanged = assignIfMissing(axisConfig, "domainColor", borderColor) || axisChanged;
  if (axisChanged) {
    config.axis = axisConfig as never;
    configChanged = true;
  }

  const legendConfig = { ...(config.legend as Record<string, unknown> | undefined) };
  let legendChanged = false;
  legendChanged = assignIfMissing(legendConfig, "labelFont", fontFamily) || legendChanged;
  legendChanged = assignIfMissing(legendConfig, "titleFont", fontFamily) || legendChanged;
  legendChanged = assignIfMissing(legendConfig, "labelColor", mutedColor) || legendChanged;
  legendChanged = assignIfMissing(legendConfig, "titleColor", textColor) || legendChanged;
  if (legendChanged) {
    config.legend = legendConfig as never;
    configChanged = true;
  }

  if (typeof config.title !== "string") {
    const titleConfig =
      typeof config.title === "object" && config.title
        ? { ...(config.title as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    let titleChanged = typeof config.title === "object" && config.title != null;
    titleChanged = assignIfMissing(titleConfig, "font", fontFamily) || titleChanged;
    titleChanged = assignIfMissing(titleConfig, "color", textColor) || titleChanged;
    if (titleChanged) {
      config.title = titleConfig as never;
      configChanged = true;
    }
  }

  const headerConfig = { ...(config.header as Record<string, unknown> | undefined) };
  let headerChanged = false;
  headerChanged = assignIfMissing(headerConfig, "labelFont", fontFamily) || headerChanged;
  headerChanged = assignIfMissing(headerConfig, "titleFont", fontFamily) || headerChanged;
  headerChanged = assignIfMissing(headerConfig, "labelColor", mutedColor) || headerChanged;
  headerChanged = assignIfMissing(headerConfig, "titleColor", textColor) || headerChanged;
  if (headerChanged) {
    config.header = headerConfig as never;
    configChanged = true;
  }

  const viewConfig = { ...(config.view as Record<string, unknown> | undefined) };
  let viewChanged = false;
  viewChanged = assignIfMissing(viewConfig, "stroke", borderColor) || viewChanged;
  if (viewChanged) {
    config.view = viewConfig as never;
    configChanged = true;
  }

  const rangeSource = config.range;
  const rangeConfig = { ...(rangeSource as Record<string, unknown> | undefined) };
  const palette = buildPalette(context);
  let rangeChanged = false;
  if (palette.length && !Array.isArray((rangeConfig as { category?: unknown }).category)) {
    rangeConfig.category = palette;
    rangeChanged = true;
  }
  if (rangeChanged || rangeSource) {
    config.range = rangeConfig as never;
    if (rangeChanged) {
      configChanged = true;
    }
  }

  if (configChanged) {
    spec.config = config as VegaLiteSpec["config"];
  }

  return spec;
}

function stripAnimatedState(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      stripAnimatedState(item);
    }
    return;
  }

  const record = value as Record<string, unknown>;

  if (record.transition !== undefined) {
    delete record.transition;
  }

  if (record.encode && typeof record.encode === "object") {
    const encode = record.encode as Record<string, unknown>;
    if (encode.update !== undefined) {
      delete encode.update;
    }
    for (const key of Object.keys(encode)) {
      stripAnimatedState(encode[key]);
    }
  }

  for (const key of Object.keys(record)) {
    if (key === "encode") {
      continue;
    }
    stripAnimatedState(record[key]);
  }
}

function prepareSpec(spec: VegaLiteSpec, element: HTMLElement, discrete: boolean): VegaLiteSpec {
  const prepared = cloneForRender(spec);
  applyTokenTheme(prepared, element);

  if (discrete) {
    if (!prepared.config || typeof prepared.config !== "object") {
      prepared.config = {} as never;
    }
    const config = { ...(prepared.config as Record<string, unknown>) };
    config.animation = animationConfig(true);
    prepared.config = config as VegaLiteSpec["config"];
    stripAnimatedState(prepared);
  }

  return prepared;
}

async function render(
  instance: VegaLiteInstance,
  spec: VegaLiteSpec,
  discrete: boolean,
): Promise<VegaEmbedResult> {
  const prepared = prepareSpec(spec, instance.element, discrete);
  const embed = instance.embed.default ?? instance.embed;
  const previousResult = instance.result;

  try {
    const result = await embed(instance.element, prepared as VisualizationSpec, {
      actions: false,
      renderer: "canvas",
      config: {
        animation: animationConfig(discrete),
      },
    });
    previousResult?.view?.finalize?.();
    instance.result = result as VegaEmbedResult;
    return instance.result;
  } catch (error) {
    instance.result = previousResult ?? null;
    throw error;
  }
}

export const vegaLiteAdapter: VizAdapter<VegaLiteInstance, VegaLiteSpec> = {
  async mount(el, spec, opts) {
    const embed = await import("vega-embed");
    const initial = cloneSpec(spec);
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec: initial,
    };
    await render(instance, initial, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(spec);
    instance.spec = clone;
    void render(instance, clone, opts.discrete);
  },
  destroy(instance) {
    instance.result?.view?.finalize?.();
    instance.result = null;
    instance.element.replaceChildren();
  },
};

export default vegaLiteAdapter;
