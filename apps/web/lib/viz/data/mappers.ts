import { createElement, type ReactNode } from "react";

import { emitVizEvent } from "../../analytics/send";
import type { EChartsOption, VegaLiteSpec, VisxRenderer, VisxSpec } from "../spec-types";
type VegaEncoding =
  Extract<VegaLiteSpec, { encoding?: object }> extends { encoding?: infer T }
    ? NonNullable<T>
    : never;
import type { VizLibraryTag } from "../types";

import type { CanonicalData, CanonicalDatum, CanonicalView, CanonicalViewType } from "./types";

export type FieldType = "quantitative" | "temporal" | "nominal";

interface FieldMeta {
  readonly type: FieldType;
  readonly domain?: { readonly min: number; readonly max: number };
  readonly timeRange?: { readonly min: number; readonly max: number };
  readonly categories?: readonly string[];
}

interface MappingContext {
  readonly data: CanonicalData;
  readonly normalizedData: NormalizedDatum[];
  readonly meta: Record<string, FieldMeta>;
  readonly order: readonly string[];
  readonly view: CanonicalView;
}

type NormalizedValue = string | number | boolean | null;
type NormalizedDatum = Record<string, NormalizedValue>;

const DEFAULT_VISX_WIDTH = 640;
const DEFAULT_VISX_HEIGHT = 400;
const DEFAULT_EVENT_MOTION = "discrete";

const SUPPORTED_TYPES = new Set(["bar", "line", "point"] satisfies readonly CanonicalViewType[]);

type ObservedKind = "number" | "string" | "boolean" | "date";

interface FieldAccumulator {
  readonly kinds: Set<ObservedKind>;
  numericMin?: number;
  numericMax?: number;
  timeMin?: number;
  timeMax?: number;
  readonly categories: string[];
  readonly categorySet: Set<string>;
}

interface VisxCartesianProps extends Record<string, unknown> {
  readonly data: CanonicalData;
  readonly normalized: readonly NormalizedDatum[];
  readonly view: CanonicalView;
  readonly meta: Record<string, FieldMeta>;
  readonly order: readonly string[];
}

const CATEGORY_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#16a34a",
  "#ea580c",
  "#db2777",
] as const;

const CARTESIAN_BACKGROUND = "#ffffff";
const CARTESIAN_AXIS_COLOR = "#4b5563";
const CARTESIAN_GRID_COLOR = "#e5e7eb";
const CARTESIAN_PRIMARY_COLOR = "#2563eb";

export function toVegaLite(data: CanonicalData, view: CanonicalView): VegaLiteSpec {
  const context = createMappingContext(data, view);

  const xChannel = { ...buildVegaChannel(context, view.x), axis: { title: view.x } };
  const yChannel = { ...buildVegaChannel(context, view.y), axis: { title: view.y } };

  const encoding: VegaEncoding = {
    x: xChannel,
    y: yChannel,
    tooltip: context.order.map((field) => ({
      field,
      type: vegaFieldType(context.meta[field]?.type ?? "nominal"),
    })),
  } as VegaEncoding;

  if (view.color) {
    encoding.color = buildVegaChannel(context, view.color);
  }

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { values: context.normalizedData },
    mark: view.type,
    encoding,
    config: {
      axis: {
        labelColor: CARTESIAN_AXIS_COLOR,
        titleColor: CARTESIAN_AXIS_COLOR,
      },
    },
  } as unknown as VegaLiteSpec;

  emitMappingEvent("vega", context);
  return spec;
}

type AxisType = "value" | "category" | "time";

export function toECharts(data: CanonicalData, view: CanonicalView): EChartsOption {
  const context = createMappingContext(data, view);
  const xMeta = context.meta[view.x];
  const yMeta = context.meta[view.y];

  const dataset = {
    dimensions: [...context.order],
    source: context.normalizedData,
  };

  const encode: Record<string, unknown> = {
    x: view.x,
    y: view.y,
    tooltip: [...context.order],
  };

  const seriesType = echartsSeriesType(view.type);
  const series: Record<string, unknown> = {
    type: seriesType,
    encode,
  };

  if (view.type === "line") {
    series.smooth = true;
  }

  if (view.type === "point") {
    series.symbolSize = 12;
  }

  const visualMaps: Array<Record<string, unknown>> = [];
  if (view.color) {
    const colorMeta = context.meta[view.color];
    if (!colorMeta) {
      throw new Error(`Color field "${view.color}" is missing from canonical data.`);
    }

    const dimensionIndex = context.order.indexOf(view.color);
    if (dimensionIndex === -1) {
      throw new Error(`Color field "${view.color}" is not part of the normalized dataset.`);
    }

    if (colorMeta.type === "quantitative") {
      const min = colorMeta.domain?.min;
      const max = colorMeta.domain?.max;
      if (typeof min === "number" && typeof max === "number") {
        visualMaps.push({
          dimension: dimensionIndex,
          min,
          max,
          calculable: true,
        });
      }
    } else if (colorMeta.type === "temporal") {
      const min = colorMeta.timeRange?.min;
      const max = colorMeta.timeRange?.max;
      if (typeof min === "number" && typeof max === "number") {
        visualMaps.push({
          dimension: dimensionIndex,
          min,
          max,
          calculable: true,
        });
      }
    } else {
      visualMaps.push({
        type: "piecewise",
        dimension: dimensionIndex,
        categories: colorMeta.categories ?? [],
      });
    }
  }

  const tooltip = {
    trigger: view.type === "bar" ? "item" : "axis",
  };

  const xAxis = {
    type: echartsAxisType(xMeta.type),
  };

  const yAxis = {
    type: echartsAxisType(yMeta.type),
  };

  const spec: EChartsOption = {
    dataset: dataset as unknown as EChartsOption["dataset"],
    series: [series] as unknown as EChartsOption["series"],
    xAxis: xAxis as unknown as EChartsOption["xAxis"],
    yAxis: yAxis as unknown as EChartsOption["yAxis"],
    tooltip: tooltip as unknown as EChartsOption["tooltip"],
  };

  if (visualMaps.length === 1) {
    spec.visualMap = visualMaps[0] as unknown as EChartsOption["visualMap"];
  } else if (visualMaps.length > 1) {
    spec.visualMap = visualMaps as unknown as EChartsOption["visualMap"];
  }

  emitMappingEvent("echarts", context);
  return spec;
}

const CartesianChart: VisxRenderer<VisxCartesianProps> = ({
  data,
  view,
  meta,
  width,
  height,
  accessibility,
}) => {
  const chartWidth = width ?? DEFAULT_VISX_WIDTH;
  const chartHeight = height ?? DEFAULT_VISX_HEIGHT;
  const margin = 48;
  const innerWidth = Math.max(1, chartWidth - margin * 2);
  const innerHeight = Math.max(1, chartHeight - margin * 2);

  const xMeta = meta[view.x];
  const yMeta = meta[view.y];
  const colorMeta = view.color ? meta[view.color] : undefined;

  const yDomain = normalizeDomain(yMeta.domain);
  const yScale = createLinearScale(yDomain.min, yDomain.max, margin + innerHeight, margin);

  const xCategories = xMeta.type === "nominal" ? (xMeta.categories ?? []) : [];
  const xDomain =
    xMeta.type === "quantitative"
      ? normalizeDomain(xMeta.domain)
      : xMeta.type === "temporal"
        ? normalizeDomain(xMeta.timeRange)
        : undefined;
  const xScale = xDomain
    ? createLinearScale(xDomain.min, xDomain.max, margin, margin + innerWidth)
    : undefined;

  const categoryPositions = new Map<string, number>();
  if (xMeta.type === "nominal") {
    const count = Math.max(1, xCategories.length);
    const step = innerWidth / count;
    xCategories.forEach((category, index) => {
      const center = margin + step * index + step / 2;
      categoryPositions.set(category, center);
    });
  }

  const colorMap = new Map<string, string>();
  const points = data
    .map((datum, datumIndex) => {
      const xRaw = datum[view.x];
      const yRaw = datum[view.y];
      if (xRaw === undefined || xRaw === null) return null;
      if (yRaw === undefined || yRaw === null) return null;

      const yValue = typeof yRaw === "number" ? yRaw : Number(yRaw);
      if (!Number.isFinite(yValue)) {
        return null;
      }

      const yCoord = yScale(yValue);

      let xCoord: number | undefined;
      let xLabel: string;
      if (xMeta.type === "nominal") {
        xLabel = normalizeNominalValue(xRaw);
        const position = categoryPositions.get(xLabel);
        if (typeof position === "number") {
          xCoord = position;
        } else {
          const dynamicIndex = categoryPositions.size;
          const count = Math.max(1, xCategories.length + dynamicIndex + 1);
          const step = innerWidth / count;
          xCoord = margin + step * dynamicIndex + step / 2;
          categoryPositions.set(xLabel, xCoord);
        }
      } else if (xMeta.type === "quantitative") {
        const value = typeof xRaw === "number" ? xRaw : Number(xRaw);
        if (!Number.isFinite(value) || !xScale) {
          return null;
        }
        xCoord = xScale(value);
        xLabel = formatNumericLabel(value);
      } else {
        const timestamp = toTimestamp(xRaw);
        if (!Number.isFinite(timestamp) || !xScale) {
          return null;
        }
        xCoord = xScale(timestamp);
        xLabel = formatTemporalLabel(timestamp);
      }

      if (typeof xCoord !== "number" || Number.isNaN(xCoord)) {
        return null;
      }

      const color = resolveColor({
        datum,
        meta: colorMeta,
        view,
        palette: CATEGORY_PALETTE,
        cache: colorMap,
      });

      return {
        xCoord,
        yCoord,
        xLabel,
        yValue,
        color,
        datumIndex,
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const linePoints =
    view.type === "line" ? [...points].sort((a, b) => a.xCoord - b.xCoord) : points;

  const barWidth = computeBarWidth(
    points.length,
    innerWidth,
    xMeta.type === "nominal" ? xCategories.length : undefined,
  );

  const shapes: ReactNode[] = [];
  if (view.type === "bar") {
    points.forEach((point, index) => {
      const heightValue = Math.max(0, margin + innerHeight - point.yCoord);
      shapes.push(
        createElement("rect", {
          key: `bar-${index}`,
          x: point.xCoord - barWidth / 2,
          y: Math.min(point.yCoord, margin + innerHeight),
          width: barWidth,
          height: heightValue,
          fill: point.color,
          opacity: 0.85,
        }),
      );
    });
  } else if (view.type === "line") {
    if (linePoints.length > 1) {
      const path = linePoints
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.xCoord},${point.yCoord}`)
        .join(" ");
      shapes.push(
        createElement("path", {
          key: "line-path",
          d: path,
          fill: "none",
          stroke: CARTESIAN_PRIMARY_COLOR,
          strokeWidth: 2,
          strokeLinejoin: "round",
          strokeLinecap: "round",
        }),
      );
    }

    linePoints.forEach((point, index) => {
      shapes.push(
        createElement("circle", {
          key: `line-point-${index}`,
          cx: point.xCoord,
          cy: point.yCoord,
          r: 5,
          fill: point.color,
          stroke: CARTESIAN_BACKGROUND,
          strokeWidth: 1,
        }),
      );
    });
  } else {
    points.forEach((point, index) => {
      shapes.push(
        createElement("circle", {
          key: `point-${index}`,
          cx: point.xCoord,
          cy: point.yCoord,
          r: 6,
          fill: point.color,
          opacity: 0.9,
        }),
      );
    });
  }

  const axisElements = buildAxes({
    margin,
    innerWidth,
    innerHeight,
    xMeta,
    xCategories,
    xDomain,
    yDomain,
  });

  const fallbackTitle = buildVisxTitle(view);
  const fallbackDescription = buildVisxDescription({
    view,
    dataPoints: points.length,
  });
  const title = accessibility.title ?? fallbackTitle;
  const description = accessibility.description ?? fallbackDescription;
  const labelledBy = `${accessibility.titleId} ${accessibility.descriptionId}`.trim();

  return createElement(
    "svg",
    {
      role: "img",
      "aria-labelledby": labelledBy || undefined,
      width: chartWidth,
      height: chartHeight,
      viewBox: `0 0 ${chartWidth} ${chartHeight}`,
      style: { background: CARTESIAN_BACKGROUND },
    },
    createElement("title", { id: accessibility.titleId, key: "title" }, title),
    createElement("desc", { id: accessibility.descriptionId, key: "desc" }, description),
    createElement("g", { key: "grid" }, ...axisElements.grid),
    createElement("g", { key: "axes" }, ...axisElements.axes),
    createElement("g", { key: "labels" }, ...axisElements.labels),
    createElement("g", { key: "marks" }, ...shapes),
  );
};

export function toVisx(data: CanonicalData, view: CanonicalView): VisxSpec<VisxCartesianProps> {
  const context = createMappingContext(data, view);

  const spec: VisxSpec<VisxCartesianProps> = {
    kind: "visx",
    width: DEFAULT_VISX_WIDTH,
    height: DEFAULT_VISX_HEIGHT,
    component: CartesianChart,
    title: buildVisxTitle(context.view),
    description: buildVisxDescription({ view: context.view, dataPoints: context.data.length }),
    props: {
      data: context.data,
      normalized: context.normalizedData,
      view: context.view,
      meta: context.meta,
      order: context.order,
    },
  };

  emitMappingEvent("visx", context);
  return spec;
}

function createMappingContext(data: CanonicalData, view: CanonicalView): MappingContext {
  if (!Array.isArray(data)) {
    throw new Error("Canonical data must be an array of records.");
  }

  if (!SUPPORTED_TYPES.has(view.type)) {
    throw new Error(`Unsupported view type: ${view.type}`);
  }

  if (data.length === 0) {
    throw new Error("Canonical data must contain at least one row.");
  }

  const normalizedView: CanonicalView = { ...view };
  const { meta, order } = analyzeCanonicalData(data);

  const xMeta = meta[normalizedView.x];
  if (!xMeta) {
    throw new Error(`Field "${normalizedView.x}" is missing from canonical data.`);
  }

  const yMeta = meta[normalizedView.y];
  if (!yMeta) {
    throw new Error(`Field "${normalizedView.y}" is missing from canonical data.`);
  }

  if (yMeta.type !== "quantitative") {
    throw new Error(`Field "${normalizedView.y}" must contain numeric values.`);
  }

  if (normalizedView.type === "line" && xMeta.type === "nominal") {
    throw new Error("Line charts require a quantitative or temporal x field.");
  }

  if (normalizedView.color) {
    const colorMeta = meta[normalizedView.color];
    if (!colorMeta) {
      throw new Error(`Field "${normalizedView.color}" is missing from canonical data.`);
    }
  }

  ensureFieldPresence(data, normalizedView.x);
  ensureFieldPresence(data, normalizedView.y);
  if (normalizedView.color) {
    ensureFieldPresence(data, normalizedView.color);
  }

  const normalizedData = normalizeCanonicalData(data, order, meta);

  return {
    data,
    normalizedData,
    meta,
    order,
    view: normalizedView,
  };
}

function ensureFieldPresence(data: CanonicalData, field: string): void {
  const hasValue = data.some((datum) => datum[field] !== undefined && datum[field] !== null);
  if (!hasValue) {
    throw new Error(`Field "${field}" must contain at least one non-null value.`);
  }
}

function analyzeCanonicalData(data: CanonicalData): {
  readonly meta: Record<string, FieldMeta>;
  readonly order: readonly string[];
} {
  const accumulators = new Map<string, FieldAccumulator>();
  const order: string[] = [];

  data.forEach((datum, rowIndex) => {
    if (typeof datum !== "object" || datum === null || Array.isArray(datum)) {
      throw new Error(`Canonical datum at index ${rowIndex} must be an object.`);
    }

    Object.keys(datum).forEach((field) => {
      const value = datum[field];
      if (value === undefined) {
        throw new Error(`Field "${field}" contains undefined values.`);
      }

      let accumulator = accumulators.get(field);
      if (!accumulator) {
        accumulator = createAccumulator();
        accumulators.set(field, accumulator);
        order.push(field);
      }

      if (value === null) {
        return;
      }

      if (value instanceof Date) {
        accumulator.kinds.add("date");
        const time = value.getTime();
        accumulator.timeMin =
          accumulator.timeMin === undefined ? time : Math.min(accumulator.timeMin, time);
        accumulator.timeMax =
          accumulator.timeMax === undefined ? time : Math.max(accumulator.timeMax, time);
        return;
      }

      const valueType = typeof value;
      switch (valueType) {
        case "number": {
          const numeric = value as number;
          accumulator.kinds.add("number");
          accumulator.numericMin =
            accumulator.numericMin === undefined
              ? numeric
              : Math.min(accumulator.numericMin, numeric);
          accumulator.numericMax =
            accumulator.numericMax === undefined
              ? numeric
              : Math.max(accumulator.numericMax, numeric);
          break;
        }
        case "string": {
          const text = value as string;
          accumulator.kinds.add("string");
          registerCategory(accumulator, text);
          break;
        }
        case "boolean": {
          const bool = value as boolean;
          accumulator.kinds.add("boolean");
          registerCategory(accumulator, bool ? "true" : "false");
          break;
        }
        default:
          throw new Error(`Unsupported value type for field "${field}": ${valueType}`);
      }
    });
  });

  const meta: Record<string, FieldMeta> = {};

  for (const [field, accumulator] of accumulators.entries()) {
    const type = determineFieldType(field, accumulator.kinds);
    if (type === "quantitative") {
      const min = accumulator.numericMin;
      const max = accumulator.numericMax;
      if (typeof min !== "number" || typeof max !== "number") {
        throw new Error(`Field "${field}" must contain numeric values.`);
      }
      meta[field] = {
        type,
        domain: { min, max },
      };
    } else if (type === "temporal") {
      const min = accumulator.timeMin;
      const max = accumulator.timeMax;
      if (typeof min !== "number" || typeof max !== "number") {
        throw new Error(`Field "${field}" must contain valid dates.`);
      }
      meta[field] = {
        type,
        timeRange: { min, max },
      };
    } else {
      meta[field] = {
        type,
        categories: [...accumulator.categories],
      };
    }
  }

  return { meta, order };
}

function createAccumulator(): FieldAccumulator {
  return {
    kinds: new Set<ObservedKind>(),
    categories: [],
    categorySet: new Set<string>(),
  };
}

function registerCategory(accumulator: FieldAccumulator, value: string): void {
  if (!accumulator.categorySet.has(value)) {
    accumulator.categorySet.add(value);
    accumulator.categories.push(value);
  }
}

function determineFieldType(field: string, kinds: Set<ObservedKind>): FieldType {
  if (kinds.has("date")) {
    if (kinds.size > 1) {
      throw new Error(`Field "${field}" mixes date values with other types.`);
    }
    return "temporal";
  }

  if (kinds.has("number")) {
    if (kinds.size > 1) {
      throw new Error(`Field "${field}" mixes numeric values with categorical data.`);
    }
    return "quantitative";
  }

  return "nominal";
}

function normalizeCanonicalData(
  data: CanonicalData,
  order: readonly string[],
  meta: Record<string, FieldMeta>,
): NormalizedDatum[] {
  return data.map((datum) => {
    const normalized: NormalizedDatum = {};
    order.forEach((field) => {
      const fieldMeta = meta[field];
      normalized[field] = normalizeValue(fieldMeta, datum[field]);
    });
    return normalized;
  });
}

function normalizeValue(
  meta: FieldMeta | undefined,
  value: CanonicalDatum[string],
): NormalizedValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (!meta) {
    return value as NormalizedValue;
  }

  switch (meta.type) {
    case "quantitative":
      return typeof value === "number" ? value : Number(value);
    case "temporal":
      if (value instanceof Date) {
        return value.toISOString();
      }
      return new Date(value as string | number).toISOString();
    default:
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      return String(value);
  }
}

function buildVegaChannel(context: MappingContext, field: string) {
  const meta = context.meta[field];
  return {
    field,
    type: vegaFieldType(meta?.type ?? "nominal"),
  };
}

function vegaFieldType(type: FieldType): "quantitative" | "temporal" | "nominal" {
  switch (type) {
    case "quantitative":
      return "quantitative";
    case "temporal":
      return "temporal";
    default:
      return "nominal";
  }
}

function echartsSeriesType(type: CanonicalViewType): string {
  switch (type) {
    case "bar":
      return "bar";
    case "line":
      return "line";
    case "point":
      return "scatter";
    default:
      return "bar";
  }
}

function echartsAxisType(type: FieldType): AxisType {
  switch (type) {
    case "quantitative":
      return "value";
    case "temporal":
      return "time";
    default:
      return "category";
  }
}

function emitMappingEvent(lib: VizLibraryTag, context: MappingContext): void {
  emitVizEvent("viz_data_mapped", {
    lib,
    motion: DEFAULT_EVENT_MOTION,
    view: context.view.type,
    fields: {
      x: context.view.x,
      y: context.view.y,
      color: context.view.color ?? null,
    },
  });
}

interface AxesElements {
  grid: ReactNode[];
  axes: ReactNode[];
  labels: ReactNode[];
}

function buildAxes(options: {
  readonly margin: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xMeta: FieldMeta;
  readonly xCategories: readonly string[];
  readonly xDomain?: { readonly min: number; readonly max: number };
  readonly yDomain: { readonly min: number; readonly max: number };
}): AxesElements {
  const { margin, innerWidth, innerHeight, xMeta, xCategories, xDomain, yDomain } = options;

  const elements: AxesElements = { grid: [], axes: [], labels: [] };

  const originX = margin;
  const originY = margin + innerHeight;
  const xEnd = margin + innerWidth;
  const yEnd = margin;

  elements.axes.push(
    createElement("line", {
      key: "x-axis",
      x1: originX,
      y1: originY,
      x2: xEnd,
      y2: originY,
      stroke: CARTESIAN_AXIS_COLOR,
      strokeWidth: 1,
    }),
    createElement("line", {
      key: "y-axis",
      x1: originX,
      y1: originY,
      x2: originX,
      y2: yEnd,
      stroke: CARTESIAN_AXIS_COLOR,
      strokeWidth: 1,
    }),
  );

  const yTicks = buildNumericTicks(yDomain.min, yDomain.max, 4);
  const yScale = createLinearScale(yDomain.min, yDomain.max, originY, yEnd);
  yTicks.forEach((tick, index) => {
    const position = yScale(tick);
    elements.grid.push(
      createElement("line", {
        key: `y-grid-${index}`,
        x1: originX,
        y1: position,
        x2: xEnd,
        y2: position,
        stroke: CARTESIAN_GRID_COLOR,
        strokeWidth: 1,
        strokeDasharray: "4 4",
      }),
    );
    elements.labels.push(
      createElement(
        "text",
        {
          key: `y-label-${index}`,
          x: originX - 8,
          y: position + 4,
          textAnchor: "end",
          fontSize: 12,
          fill: CARTESIAN_AXIS_COLOR,
        },
        formatNumericLabel(tick),
      ),
    );
  });

  if (xMeta.type === "nominal") {
    const count = Math.max(1, xCategories.length);
    const step = innerWidth / count;
    xCategories.forEach((category, index) => {
      const position = originX + step * index + step / 2;
      elements.labels.push(
        createElement(
          "text",
          {
            key: `x-label-${index}`,
            x: position,
            y: originY + 20,
            textAnchor: "middle",
            fontSize: 12,
            fill: CARTESIAN_AXIS_COLOR,
          },
          category,
        ),
      );
    });
  } else {
    const domain = xDomain ?? { min: 0, max: 1 };
    const ticks = buildNumericTicks(domain.min, domain.max, 4);
    const scale = createLinearScale(domain.min, domain.max, originX, xEnd);
    ticks.forEach((tick, index) => {
      const position = scale(tick);
      const label =
        xMeta.type === "temporal" ? formatTemporalLabel(tick) : formatNumericLabel(tick);
      elements.labels.push(
        createElement(
          "text",
          {
            key: `x-label-${index}`,
            x: position,
            y: originY + 20,
            textAnchor: "middle",
            fontSize: 12,
            fill: CARTESIAN_AXIS_COLOR,
          },
          label,
        ),
      );
    });
  }

  return elements;
}

function buildNumericTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0];
  }

  if (min === max) {
    return [min];
  }

  const ticks: number[] = [];
  const step = (max - min) / count;
  for (let index = 0; index <= count; index += 1) {
    ticks.push(min + step * index);
  }
  return ticks;
}

function normalizeDomain(domain?: { readonly min: number; readonly max: number }): {
  readonly min: number;
  readonly max: number;
} {
  if (!domain || !Number.isFinite(domain.min) || !Number.isFinite(domain.max)) {
    return { min: 0, max: 1 };
  }

  if (domain.min === domain.max) {
    return { min: domain.min - 1, max: domain.max + 1 };
  }

  return domain;
}

function createLinearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const span = domainMax - domainMin;
  if (span === 0) {
    return () => (rangeMin + rangeMax) / 2;
  }

  return (value: number) => {
    const ratio = (value - domainMin) / span;
    return rangeMin + ratio * (rangeMax - rangeMin);
  };
}

function formatNumericLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const abs = Math.abs(value);
  if (abs >= 1000 || abs < 0.001) {
    return value.toExponential(1);
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2).replace(/\.0+$/, "");
}

function formatTemporalLabel(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp).toISOString().split("T")[0] ?? "";
}

function normalizeNominalValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "(null)";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  return NaN;
}

function resolveColor(options: {
  readonly datum: CanonicalDatum;
  readonly meta?: FieldMeta;
  readonly view: CanonicalView;
  readonly palette: readonly string[];
  readonly cache: Map<string, string>;
}): string {
  const { datum, meta, view, palette, cache } = options;
  const field = view.color;
  if (!field || !meta) {
    return CARTESIAN_PRIMARY_COLOR;
  }

  const value = datum[field];
  if (value === undefined || value === null) {
    return "#6b7280";
  }

  if (meta.type === "quantitative") {
    const numeric = typeof value === "number" ? value : Number(value);
    const min = meta.domain?.min ?? numeric;
    const max = meta.domain?.max ?? numeric;
    return interpolateColor(numeric, min, max);
  }

  if (meta.type === "temporal") {
    const timestamp = toTimestamp(value);
    const min = meta.timeRange?.min ?? timestamp;
    const max = meta.timeRange?.max ?? timestamp;
    return interpolateColor(timestamp, min, max);
  }

  const key = normalizeNominalValue(value);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const next = palette[cache.size % palette.length];
  cache.set(key, next);
  return next;
}

function interpolateColor(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return CARTESIAN_PRIMARY_COLOR;
  }
  if (min === max) {
    return CARTESIAN_PRIMARY_COLOR;
  }
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const start = [37, 99, 235];
  const end = [220, 38, 38];
  const channels = start.map((channel, index) => {
    const target = end[index];
    return Math.round(channel + (target - channel) * ratio);
  });
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function computeBarWidth(pointCount: number, innerWidth: number, categoryCount?: number): number {
  if (categoryCount && categoryCount > 0) {
    return Math.max(8, (innerWidth / categoryCount) * 0.7);
  }
  if (pointCount === 0) {
    return Math.max(8, innerWidth * 0.1);
  }
  return Math.max(8, (innerWidth / pointCount) * 0.6);
}

function formatViewTypeForTitle(type: CanonicalViewType): string {
  if (!type) {
    return "Chart";
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildVisxTitle(view: CanonicalView): string {
  const formattedType = formatViewTypeForTitle(view.type);
  return `${formattedType} chart of ${view.y} by ${view.x}`;
}

function buildVisxDescription(options: {
  readonly view: CanonicalView;
  readonly dataPoints: number;
}): string {
  const { view, dataPoints } = options;
  const segments = [`Plots the ${view.y} field against ${view.x}.`];
  if (view.color) {
    segments.push(`Color encodes ${view.color}.`);
  }
  const count = Math.max(0, dataPoints);
  segments.push(`Includes ${count} data point${count === 1 ? "" : "s"}.`);
  return segments.join(" ");
}
