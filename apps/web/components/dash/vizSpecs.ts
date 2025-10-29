// Набор минимальных спецификаций для демо

// --- Vega-Lite: столбики по категориям ---
export const VL_BAR_MIN = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  width: "container",
  height: 240,
  data: { name: "values" }, // <VizWidget> передаёт через embed(data)
  mark: { type: "bar" },
  encoding: {
    x: { field: "category", type: "nominal", axis: { labelAngle: 0 } },
    y: { field: "value", type: "quantitative" },
    color: { field: "category", type: "nominal" },
  },
} as const;

// --- Vega-Lite: линия по времени ---
export const VL_LINE_MIN = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  width: "container",
  height: 240,
  data: { name: "values" },
  mark: { type: "line", interpolate: "monotone" },
  encoding: {
    x: { field: "t", type: "temporal", axis: { format: "%b %d" } },
    y: { field: "y", type: "quantitative" },
  },
} as const;

// --- ECharts: столбики ---
export const EC_BAR_MIN = (values: Array<{ category: string; value: number }>) => ({
  grid: { left: 8, right: 8, top: 24, bottom: 32, containLabel: true },
  xAxis: { type: "category", data: values.map((v) => v.category) },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: values.map((v) => v.value) }],
});

// --- ECharts: линия ---
export const EC_LINE_MIN = (points: Array<{ t: string | number; y: number }>) => ({
  grid: { left: 8, right: 8, top: 24, bottom: 32, containLabel: true },
  xAxis: { type: "category", data: points.map((p) => p.t) },
  yAxis: { type: "value" },
  series: [{ type: "line", smooth: true, data: points.map((p) => p.y) }],
});
