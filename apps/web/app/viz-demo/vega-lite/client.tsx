"use client";

import VizHarness from "@/lib/viz/VizHarness";
import { vegaLiteAdapter } from "@/lib/viz/adapters/vegaLite";
import type { VegaLiteSpec } from "@/lib/viz/spec-types";

const DEMO_SPEC: VegaLiteSpec = {
  data: {
    values: [
      { category: "Alpha", value: 42 },
      { category: "Beta", value: 36 },
      { category: "Gamma", value: 58 },
      { category: "Delta", value: 27 },
    ],
  },
  mark: "bar",
  encoding: {
    x: { field: "category", type: "nominal", title: "Категория" },
    y: { field: "value", type: "quantitative", title: "Значение" },
    color: { field: "category", type: "nominal" },
  },
  config: {
    axis: {
      labelFontSize: 12,
      titleFontSize: 14,
    },
  },
};

export default function VegaLiteDemo() {
  return (
    <VizHarness
      adapter={vegaLiteAdapter}
      spec={DEMO_SPEC}
      state={{}}
      testId="vega-lite-chart"
      height={420}
      className="rounded-xl border border-muted/20 bg-bg"
    />
  );
}
