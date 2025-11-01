"use client";

import { useEffect, useRef, useState } from "react";

import { LegacyVizHarness } from "@/lib/viz/VizHarness";
import { vegaLiteAdapter } from "@/lib/viz/adapters/vegaLite";
import type { VegaLiteSpec } from "@/lib/viz/spec-types";

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

type VegaLiteInstance = Awaited<ReturnType<typeof vegaLiteAdapter.mount>>;

export default function VegaLiteClient() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const instanceRef = useRef<VegaLiteInstance | null>(null);

  useEffect(() => {
    if (!container) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const instance = await vegaLiteAdapter.mount({
          el: container,
          spec: SAMPLE_SPEC,
          discrete: false,
        });
        if (cancelled) {
          await instance.destroy();
          return;
        }
        instanceRef.current = instance;
      } catch (error) {
        console.error("[e2e] Failed to mount Vega-Lite demo", error);
      }
    })();

    return () => {
      cancelled = true;
      const instance = instanceRef.current;
      if (instance) {
        void instance.destroy();
        instanceRef.current = null;
      }
    };
  }, [container]);

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
      <LegacyVizHarness
        testId="vega-lite-chart"
        defaultHeight={420}
        onContainerChange={setContainer}
        className="rounded-xl border border-muted/20 bg-bg"
        aria-label="Vega-Lite demo chart"
        role="figure"
      />
    </main>
  );
}
