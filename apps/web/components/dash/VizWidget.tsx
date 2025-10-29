"use client";

import { useEffect, useRef, useState } from "react";

type VegaLiteSpec = import("vega-embed").VisualizationSpec;
type EChartsOption = import("echarts").EChartsOption;

type SupportedLibraries = "vega-lite" | "echarts";

export type VizWidgetProps = {
  title?: string;
  lib?: SupportedLibraries;
  spec?: unknown;
  data?: unknown;
};

export default function VizWidget({ title, lib, spec, data }: VizWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function renderChart() {
      if (!element || !lib || !spec) return;
      if (!isRecord(spec)) {
        element.innerHTML = "";
        setError("Некорректная спецификация графика");
        return;
      }

      try {
        setError(null);
        element.innerHTML = "";

        if (lib === "vega-lite") {
          const { default: embed } = await import("vega-embed");
          if (disposed || !containerRef.current) return;

          const resolvedSpec = attachDataToSpec(lib, spec, data) as VegaLiteSpec | undefined;
          const result = await embed(containerRef.current, (resolvedSpec ?? spec) as VegaLiteSpec, {
            actions: false,
          });

          cleanup = () => {
            result?.finalize?.();
            result?.view?.finalize?.();
          };
        }

        if (lib === "echarts") {
          const echartsModule = await import("echarts");
          const echarts =
            (echartsModule as { default?: typeof import("echarts") }).default ?? echartsModule;
          if (disposed || !containerRef.current) return;

          const instance = echarts.init(containerRef.current);
          const resolvedSpec = attachDataToSpec(lib, spec, data) as EChartsOption | undefined;
          instance.setOption((resolvedSpec ?? spec) as EChartsOption, true);

          cleanup = () => {
            instance?.dispose?.();
          };
        }
      } catch (err) {
        if (!disposed) {
          console.error("Failed to render chart", err);
          setError("Не удалось загрузить график");
        }
      }
    }

    renderChart();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [lib, spec, data]);

  return (
    <section className="rounded-xl border p-4 mb-4">
      {title && <h2 className="text-lg font-medium mb-2">{title}</h2>}
      {lib && spec ? (
        <div ref={containerRef} className="min-h-[220px]" />
      ) : (
        <div className="text-sm text-gray-500">Здесь будет график…</div>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}

function attachDataToSpec(
  lib: SupportedLibraries | undefined,
  spec: unknown,
  data: unknown,
): unknown {
  if (!lib || !data || !isRecord(spec)) return spec;

  if (lib === "vega-lite") {
    if (isRecord(data) && "values" in data) {
      return { ...spec, data };
    }

    return {
      ...spec,
      data: Array.isArray(data) ? { values: data } : data,
    };
  }

  if (lib === "echarts") {
    if (isRecord(data) && "source" in data) {
      return { ...spec, dataset: data };
    }

    return {
      ...spec,
      dataset: Array.isArray(data) ? { source: data } : data,
    };
  }

  return spec;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
