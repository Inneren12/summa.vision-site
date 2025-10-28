import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/send", () => ({
  emitVizEvent: vi.fn(() => true),
}));

import { emitVizEvent } from "@/lib/analytics/send";
import { toECharts, toVegaLite, toVisx } from "@/lib/viz/data/mappers";
import type { CanonicalData } from "@/lib/viz/data/types";

describe("canonical data mappers", () => {
  const data: CanonicalData = [
    { category: "A", value: 10, segment: "North", date: new Date("2024-01-01") },
    { category: "B", value: 18, segment: "South", date: new Date("2024-02-01") },
    { category: "C", value: 5, segment: "East", date: new Date("2024-03-01") },
  ];

  beforeEach(() => {
    vi.mocked(emitVizEvent).mockClear();
  });

  it("creates a Vega-Lite specification", () => {
    const spec = toVegaLite(data, { x: "category", y: "value", color: "segment", type: "bar" });

    expect(spec.encoding?.x).toMatchObject({ field: "category", type: "nominal" });
    expect(spec.encoding?.y).toMatchObject({ field: "value", type: "quantitative" });
    expect(spec.encoding?.color).toMatchObject({ field: "segment", type: "nominal" });
    expect(spec.data?.values?.[0]).toMatchObject({
      category: "A",
      value: 10,
      segment: "North",
    });
    expect(spec.data?.values?.[0]?.date).toBe("2024-01-01T00:00:00.000Z");
    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_data_mapped",
      expect.objectContaining({ lib: "vega", motion: "discrete" }),
    );
  });

  it("creates an ECharts specification", () => {
    const spec = toECharts(data, { x: "date", y: "value", color: "segment", type: "line" });

    const dimensions = Array.isArray(spec.dataset)
      ? spec.dataset[0]?.dimensions
      : spec.dataset?.dimensions;
    expect(dimensions).toEqual(expect.arrayContaining(["date", "value", "segment", "category"]));

    const series = Array.isArray(spec.series) ? spec.series[0] : spec.series;
    expect(series?.type).toBe("line");
    expect(series?.encode).toMatchObject({ x: "date", y: "value" });

    const visualMap = Array.isArray(spec.visualMap) ? spec.visualMap[0] : spec.visualMap;
    expect(visualMap).toMatchObject({
      type: "piecewise",
      categories: expect.arrayContaining(["North"]),
    });

    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_data_mapped",
      expect.objectContaining({ lib: "echarts", motion: "discrete" }),
    );
  });

  it("creates a Visx specification", () => {
    const spec = toVisx(data, { x: "category", y: "value", color: "segment", type: "bar" });

    expect(spec.width).toBeGreaterThan(0);
    expect(spec.height).toBeGreaterThan(0);
    expect(typeof spec.component).toBe("function");
    expect(spec.props?.meta.category?.type).toBe("nominal");
    expect(spec.props?.meta.value?.type).toBe("quantitative");

    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_data_mapped",
      expect.objectContaining({ lib: "visx", motion: "discrete" }),
    );
  });

  it("validates required fields", () => {
    expect(() => toVegaLite([{ value: 42 }], { x: "category", y: "value", type: "bar" })).toThrow(
      /missing from canonical data/i,
    );
  });

  it("prevents nominal lines", () => {
    expect(() => toECharts(data, { x: "category", y: "value", type: "line" })).toThrow(
      /require a quantitative or temporal x field/i,
    );
  });
});
