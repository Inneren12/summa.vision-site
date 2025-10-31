"use client";

import { VizHarness } from "@/lib/viz/VizHarness";
import { vegaLiteAdapter, type VegaLiteState } from "@/lib/viz/adapters/vegaLite";
import type { VegaLiteSpec } from "@/lib/viz/spec-types";
import { useVizMount } from "@/lib/viz/useVizMount";

const SAMPLE_SPEC: VegaLiteSpec = {
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

export default function VegaLiteClient() {
  const viz = useVizMount<VegaLiteState, VegaLiteSpec>({
    adapter: vegaLiteAdapter,
    spec: SAMPLE_SPEC,
    discrete: false,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          E2E Harness
        </p>
        <h1 className="text-2xl font-bold">Vega-Lite Resize Stability</h1>
        <p className="text-sm text-muted-foreground">
          Контейнер фиксирует размеры и гарантирует стабильное отображение Canvas.
        </p>
      </header>
      <VizHarness
        testId="vega-lite-chart"
        defaultHeight={420}
        onContainerChange={viz.ref}
        className="rounded-xl border border-muted/20 bg-bg"
        aria-label="Vega-Lite demo chart"
        role="figure"
      />
    </main>
  );
}
