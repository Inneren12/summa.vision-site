import type { VizAdapter } from "../types";

type VegaLiteSpec = import("vega-lite").TopLevelSpec;
type VegaLiteConfig = import("vega-lite").Config;
type VegaEmbedModule = typeof import("vega-embed");
type VegaEmbedResult = import("vega-embed").Result;
type VegaFontWeight = import("vega").FontWeight;

interface VegaLiteInstance {
  element: HTMLElement;
  embed: VegaEmbedModule;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec;
}

type UnknownRecord = Record<string, unknown>;

const FALLBACK_THEME = {
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
  fontSizePx: "16px",
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  radiusSmall: "8px",
  colors: {
    fgMuted: "#3c424a",
    fgDefault: "#101418",
    fgSubtle: "#6e7682",
    bgSurface: "#fafbfc",
    borderSubtle: "#e6eaf0",
    borderEmphasis: "#b8c0ca",
    borderDefault: "#d3d9e1",
    tooltipBg: "#111827",
    tooltipText: "#F9FAFB",
    brandBlue: "#2fafea",
    accentTeal: "#1bb6a1",
    accentMagenta: "#d6569e",
    accentOrange: "#f47c3c",
    accentYellow: "#f5c04a",
    accentViolet: "#7056e2",
    neutral700: "#3c424a",
    neutral500: "#9ca4b1",
  },
} as const;

function cloneDatasets(datasets: unknown): unknown {
  if (!datasets || typeof datasets !== "object") {
    return datasets;
  }
  const entries = Object.entries(datasets as UnknownRecord);
  const clone: UnknownRecord = {};
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      clone[key] = value.slice();
      continue;
    }
    if (value && typeof value === "object") {
      const record = value as UnknownRecord;
      const next = { ...record };
      if (Array.isArray(next.values)) {
        next.values = next.values.slice();
      }
      clone[key] = next;
      continue;
    }
    clone[key] = value;
  }
  return clone;
}

function cloneData(data: unknown): unknown {
  if (!data) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((entry) => cloneData(entry));
  }
  if (typeof data === "object") {
    const copy = { ...(data as UnknownRecord) };
    if (Array.isArray(copy.values)) {
      copy.values = copy.values.slice();
    }
    return copy;
  }
  return data;
}

function cloneSpec(spec: VegaLiteSpec): VegaLiteSpec {
  const source = spec as unknown as UnknownRecord;
  const cloneRecord: UnknownRecord = { ...source };

  const config = (source as { config?: unknown }).config;
  if (config && typeof config === "object") {
    cloneRecord.config = { ...(config as UnknownRecord) };
  }

  const data = (source as { data?: unknown }).data;
  if (typeof data !== "undefined") {
    cloneRecord.data = cloneData(data);
  }

  const datasets = (source as { datasets?: unknown }).datasets;
  if (datasets && typeof datasets === "object") {
    cloneRecord.datasets = cloneDatasets(datasets);
  }

  return cloneRecord as unknown as VegaLiteSpec;
}

function readComputedStyle(element: HTMLElement): CSSStyleDeclaration | null {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return null;
  }
  return window.getComputedStyle(element);
}

function readCssVar(styles: CSSStyleDeclaration | null, name: string, fallback: string): string {
  if (!styles) {
    return fallback;
  }
  const value = styles.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

function parseNumber(value: string, fallback: number): number {
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : fallback;
}

function mergeConfig(theme: VegaLiteConfig, base?: VegaLiteConfig): VegaLiteConfig {
  if (!base) {
    return theme;
  }

  const merged: VegaLiteConfig = { ...theme, ...base };

  if (theme.axis || base.axis) {
    merged.axis = { ...(theme.axis ?? {}), ...(base.axis ?? {}) };
  }

  if (theme.legend || base.legend) {
    merged.legend = { ...(theme.legend ?? {}), ...(base.legend ?? {}) };
  }

  if (theme.title || base.title) {
    merged.title = { ...(theme.title ?? {}), ...(base.title ?? {}) };
  }

  if (theme.header || base.header) {
    merged.header = { ...(theme.header ?? {}), ...(base.header ?? {}) };
  }

  if (theme.view || base.view) {
    merged.view = { ...(theme.view ?? {}), ...(base.view ?? {}) };
  }

  if (theme.range || base.range) {
    merged.range = { ...(theme.range ?? {}), ...(base.range ?? {}) };
  }

  if (theme.style || base.style) {
    merged.style = { ...(theme.style ?? {}), ...(base.style ?? {}) };
  }

  if (theme.mark || base.mark) {
    merged.mark = { ...(theme.mark ?? {}), ...(base.mark ?? {}) };
  }

  return merged;
}

function applyTheme(element: HTMLElement, spec: VegaLiteSpec): VegaLiteSpec {
  const styles = readComputedStyle(element);

  const fontFamily = readCssVar(styles, "--font-family-sans", FALLBACK_THEME.fontFamily);
  const fontSizeRaw = readCssVar(styles, "--font-size-body", FALLBACK_THEME.fontSizePx);
  const fontSize = parseNumber(fontSizeRaw, Number.parseFloat(FALLBACK_THEME.fontSizePx));
  const labelColor = readCssVar(styles, "--color-fg-muted", FALLBACK_THEME.colors.fgMuted);
  const titleColor = readCssVar(styles, "--color-fg-default", FALLBACK_THEME.colors.fgDefault);
  const legendLabelColor = readCssVar(styles, "--color-fg-subtle", FALLBACK_THEME.colors.fgSubtle);
  const background = readCssVar(styles, "--color-bg-surface", FALLBACK_THEME.colors.bgSurface);
  const gridColor = readCssVar(styles, "--color-border-subtle", FALLBACK_THEME.colors.borderSubtle);
  const domainColor = readCssVar(
    styles,
    "--color-border-emphasis",
    FALLBACK_THEME.colors.borderEmphasis,
  );
  const tickColor = readCssVar(
    styles,
    "--color-border-default",
    FALLBACK_THEME.colors.borderDefault,
  );
  const tooltipBg = readCssVar(styles, "--component-tooltip-bg", FALLBACK_THEME.colors.tooltipBg);
  const tooltipColor = readCssVar(
    styles,
    "--component-tooltip-text",
    FALLBACK_THEME.colors.tooltipText,
  );
  const weightMedium = parseNumber(
    readCssVar(styles, "--font-weight-medium", String(FALLBACK_THEME.fontWeightMedium)),
    FALLBACK_THEME.fontWeightMedium,
  ) as VegaFontWeight;
  const weightSemibold = parseNumber(
    readCssVar(styles, "--font-weight-semibold", String(FALLBACK_THEME.fontWeightSemibold)),
    FALLBACK_THEME.fontWeightSemibold,
  ) as VegaFontWeight;
  const tooltipRadiusRaw = readCssVar(styles, "--radius-s", FALLBACK_THEME.radiusSmall);
  const tooltipRadius = parseNumber(
    tooltipRadiusRaw,
    Number.parseFloat(FALLBACK_THEME.radiusSmall),
  );

  const palette = [
    readCssVar(styles, "--color-brand-blue-500", FALLBACK_THEME.colors.brandBlue),
    readCssVar(styles, "--color-accent-teal", FALLBACK_THEME.colors.accentTeal),
    readCssVar(styles, "--color-accent-magenta", FALLBACK_THEME.colors.accentMagenta),
    readCssVar(styles, "--color-accent-orange", FALLBACK_THEME.colors.accentOrange),
    readCssVar(styles, "--color-accent-yellow", FALLBACK_THEME.colors.accentYellow),
    readCssVar(styles, "--color-accent-violet", FALLBACK_THEME.colors.accentViolet),
    readCssVar(styles, "--color-neutral-700", FALLBACK_THEME.colors.neutral700),
    readCssVar(styles, "--color-neutral-500", FALLBACK_THEME.colors.neutral500),
  ];

  const themedConfig: VegaLiteConfig = {
    background,
    font: fontFamily,
    view: {
      stroke: null,
      fill: background,
    },
    axis: {
      labelColor,
      labelFont: fontFamily,
      labelFontSize: fontSize,
      labelFontWeight: weightMedium,
      titleColor,
      titleFont: fontFamily,
      titleFontWeight: weightSemibold,
      gridColor,
      domainColor,
      tickColor,
    },
    legend: {
      labelColor: legendLabelColor,
      labelFont: fontFamily,
      titleColor,
      titleFont: fontFamily,
      titleFontWeight: weightSemibold,
    },
    title: {
      color: titleColor,
      font: fontFamily,
      fontWeight: weightSemibold,
    },
    header: {
      labelColor,
      labelFont: fontFamily,
      labelFontWeight: weightMedium,
      titleColor,
      titleFont: fontFamily,
      titleFontWeight: weightSemibold,
    },
    mark: {
      font: fontFamily,
      fontSize,
    },
    range: {
      category: palette,
    },
    style: {
      "guide-label": {
        font: fontFamily,
        fill: labelColor,
        fontSize,
        fontWeight: weightMedium,
      },
      "guide-title": {
        font: fontFamily,
        fill: titleColor,
        fontWeight: weightSemibold,
      },
      tooltip: {
        fill: tooltipBg,
        stroke: tooltipBg,
        color: tooltipColor,
        cornerRadius: tooltipRadius,
      },
    },
  };

  const clone = cloneSpec(spec);
  clone.config = mergeConfig(themedConfig, clone.config as VegaLiteConfig | undefined);
  return clone;
}

function sanitizeMotion<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    let mutated = false;
    const next = value.map((item) => {
      const result = sanitizeMotion(item);
      if (result !== item) {
        mutated = true;
      }
      return result;
    });
    return mutated ? (next as unknown as T) : value;
  }

  const record = value as UnknownRecord;
  let mutated = false;
  let encodeReplacement: unknown = record.encode;

  if (record.encode && typeof record.encode === "object") {
    const encodeRecord = record.encode as UnknownRecord;
    if ("update" in encodeRecord) {
      const rest = { ...encodeRecord };
      delete rest.update;
      mutated = true;
      const sanitized = sanitizeMotion(rest);
      if (sanitized && Object.keys(sanitized as UnknownRecord).length > 0) {
        encodeReplacement = sanitized;
      } else {
        encodeReplacement = undefined;
      }
    } else {
      const sanitized = sanitizeMotion(encodeRecord);
      if (sanitized !== encodeRecord) {
        mutated = true;
        encodeReplacement = sanitized;
      }
    }
  }

  let nextRecord: UnknownRecord | undefined;
  for (const [key, current] of Object.entries(record)) {
    if (key === "encode") {
      continue;
    }
    const sanitized = sanitizeMotion(current);
    if (sanitized !== current) {
      if (!mutated) {
        mutated = true;
      }
      nextRecord = nextRecord ?? { ...record };
      nextRecord[key] = sanitized;
    }
  }

  if (!mutated && !("transition" in record) && !("transitions" in record)) {
    return value;
  }

  const base = nextRecord ?? { ...record };
  delete base.transition;
  delete base.transitions;
  if (typeof encodeReplacement === "undefined") {
    delete base.encode;
  } else {
    base.encode = encodeReplacement;
  }
  return base as unknown as T;
}

function disableMotion(spec: VegaLiteSpec): VegaLiteSpec {
  const sanitized = sanitizeMotion(spec) as VegaLiteSpec;
  if (sanitized.config) {
    sanitized.config = { ...(sanitized.config as UnknownRecord) } as VegaLiteSpec["config"];
  }
  return sanitized;
}

async function render(
  instance: VegaLiteInstance,
  spec: VegaLiteSpec,
  discrete: boolean,
): Promise<VegaEmbedResult> {
  const prepared = applyTheme(instance.element, spec);
  const finalSpec = discrete ? disableMotion(prepared) : prepared;
  const embed = instance.embed.default ?? instance.embed;
  const result = await embed(instance.element, finalSpec, {
    actions: false,
    renderer: "svg",
    hover: discrete ? false : undefined,
  });
  instance.result?.finalize?.();
  instance.result = result;
  instance.spec = finalSpec;
  return result;
}

export const vegaLiteAdapter: VizAdapter<VegaLiteInstance, VegaLiteSpec> = {
  async mount(el, spec, opts) {
    const embed = await import("vega-embed");
    const initialSpec = cloneSpec(spec);
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec: initialSpec,
    };
    await render(instance, initialSpec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    void render(instance, cloneSpec(spec), opts.discrete);
  },
  destroy(instance) {
    instance.result?.finalize?.();
    instance.result = null;
    instance.element.replaceChildren();
  },
};
