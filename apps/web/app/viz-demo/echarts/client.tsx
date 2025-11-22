"use client";

import VizHarness from "@/lib/viz/VizHarness";
import { echartsAdapter } from "@/lib/viz/adapters/echarts";
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
      adapter={echartsAdapter}
      spec={DEMO_SPEC}
      state={{}}
      testId="echarts-chart"
      height={420}
      className="rounded-xl border border-muted/20 bg-bg"
    />
  );
}
