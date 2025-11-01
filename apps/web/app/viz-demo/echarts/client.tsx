"use client";

import VizHarness from "@/lib/viz/VizHarness";
import { echartsVizAdapter } from "@/lib/viz/adapters/echarts.adapter";
import type { EChartsSpec } from "@/lib/viz/spec-types";

const DEMO_SPEC: EChartsSpec = {
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: ["Q1", "Q2", "Q3", "Q4"],
    boundaryGap: false,
  },
  yAxis: { type: "value" },
  series: [
    {
      type: "line",
      data: [820, 932, 901, 1090],
      smooth: true,
      areaStyle: {},
    },
  ],
};

export default function EChartsDemo() {
  return (
    <VizHarness
      adapter={echartsVizAdapter}
      spec={DEMO_SPEC}
      state={{}}
      testId="echarts-chart"
      height={420}
      className="rounded-xl border border-muted/20 bg-bg"
    />
  );
}
