"use client";

import { useEffect, useMemo, useState } from "react";

import { vegaLiteAdapter } from "@/lib/viz/adapters/vegaLite";
import type { VegaLiteSpec } from "@/lib/viz/spec-types";
import { useVizMount } from "@/lib/viz/useVizMount";

const DATA = [
  { category: "Alpha", value: 32 },
  { category: "Beta", value: 44 },
  { category: "Gamma", value: 28 },
  { category: "Delta", value: 36 },
] as const;

const CATEGORIES = DATA.map((item) => item.category);
const INITIAL_SELECTION = CATEGORIES[0];

const SPEC: VegaLiteSpec = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  description: "Демо-гистограмма для проверки Vega-Lite адаптера",
  data: { values: DATA },
  autosize: { type: "fit", contains: "padding" },
  mark: { type: "bar", cornerRadiusTopLeft: 6, cornerRadiusTopRight: 6 },
  encoding: {
    x: {
      field: "category",
      type: "nominal",
      axis: { title: "Категория", labelAngle: 0 },
    },
    y: {
      field: "value",
      type: "quantitative",
      axis: { title: "Значение" },
    },
    color: {
      condition: {
        test: "selection && datum.category === selection",
        value: "#2563eb",
      },
      value: "#cbd5f5",
    },
    tooltip: [
      { field: "category", title: "Категория" },
      { field: "value", title: "Значение" },
    ],
  },
  params: [
    {
      name: "selection",
      value: INITIAL_SELECTION,
    },
  ],
} satisfies VegaLiteSpec;

export function VegaLiteDemo() {
  const [selection, setSelection] = useState<string | undefined>(INITIAL_SELECTION);
  const [eventSelection, setEventSelection] = useState<string | undefined>(INITIAL_SELECTION);

  const categories = useMemo(() => CATEGORIES, []);

  const viz = useVizMount<{ selection?: string }, VegaLiteSpec>({
    adapter: vegaLiteAdapter,
    spec: SPEC,
    discrete: false,
    initialState: { selection: INITIAL_SELECTION },
    onEvent: (event) => {
      if (event.type !== "viz_state") {
        return;
      }
      const metaSelection = event.meta?.selection;
      if (typeof metaSelection === "string" && metaSelection.length > 0) {
        setEventSelection(metaSelection);
      } else if (metaSelection === null || typeof metaSelection === "undefined") {
        setEventSelection(undefined);
      }
    },
  });

  useEffect(() => {
    if (!viz.instance) {
      return;
    }
    void viz.instance.applyState({ selection });
  }, [selection, viz.instance]);

  const select = (value?: string) => () => {
    setSelection(value);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            className="rounded-md border border-muted/40 px-3 py-1 text-sm transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            data-active={selection === value}
            aria-pressed={selection === value}
            onClick={select(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border border-muted/40 px-3 py-1 text-sm transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
          data-active={selection == null}
          aria-pressed={selection == null}
          onClick={select(undefined)}
        >
          Сброс
        </button>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="vega-lite-selection-display">
        Текущий выбор: {eventSelection ?? "нет"}
      </p>
      <div
        ref={viz.ref}
        data-testid="vega-lite-chart"
        className="h-[320px] w-full rounded-xl border border-muted/30 bg-background"
        role="group"
        aria-label="Демонстрация Vega-Lite"
      />
    </section>
  );
}

export default VegaLiteDemo;
