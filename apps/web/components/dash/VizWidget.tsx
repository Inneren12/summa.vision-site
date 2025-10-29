"use client";

import { useReducedMotion } from "@root/components/motion/useReducedMotion";
import { useEffect, useMemo, useRef, useState } from "react";

export type VizLibrary = "vega-lite" | "echarts";

export type VizWidgetProps = {
  /** Заголовок виджета */
  title?: string;
  /** Название визуализационной библиотеки */
  lib?: VizLibrary;
  /** Спецификация графика (Vega-Lite или ECharts) */
  spec?: Record<string, unknown>;
  /** Данные, которые нужно передать в визуализацию */
  data?: unknown;
  /** Дополнительные CSS-классы контейнера */
  className?: string;
};

const FALLBACK_MESSAGE = "Здесь будет график…";

export default function VizWidget({ title, lib, spec, data, className }: VizWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { isReducedMotion } = useReducedMotion();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let teardown: (() => void) | undefined;

    async function render() {
      if (!lib || !spec) {
        return;
      }

      const target = containerRef.current;
      if (!target) {
        return;
      }

      setErrorMessage(null);
      target.replaceChildren();

      try {
        if (lib === "vega-lite") {
          const { default: embed } = await import("vega-embed");
          if (isCancelled) {
            return;
          }

          const { data: specData } = spec as { data?: unknown };
          const specDataObject =
            specData && typeof specData === "object" && specData !== null ? specData : null;
          const namedDataKey =
            specDataObject && "name" in specDataObject && typeof specDataObject.name === "string"
              ? (specDataObject.name as string)
              : null;

          let embedData: Record<string, unknown> | undefined;
          if (namedDataKey && data !== undefined) {
            embedData = { [namedDataKey]: data } as Record<string, unknown>;
          } else if (data && typeof data === "object") {
            embedData = data as Record<string, unknown>;
          }

          const result = await embed(target, spec, {
            actions: false,
            renderer: isReducedMotion ? "svg" : "canvas",
            ...(embedData ? { data: embedData } : {}),
          });

          teardown = () => {
            try {
              result?.view?.finalize?.();
            } catch (error) {
              console.warn("Не удалось корректно завершить Vega-визуализацию", error);
            }
            target.replaceChildren();
          };
        } else if (lib === "echarts") {
          const { default: echarts } = await import("echarts");
          if (isCancelled) {
            return;
          }

          const instance = echarts.init(target, undefined, {
            renderer: isReducedMotion ? "svg" : "canvas",
          });

          const baseOption = spec as Record<string, unknown>;
          const option = isReducedMotion ? { ...baseOption, animation: false } : baseOption;

          instance.setOption(option, { notMerge: true, lazyUpdate: false });

          const handleResize = () => {
            instance.resize?.();
          };

          window.addEventListener("resize", handleResize);

          teardown = () => {
            window.removeEventListener("resize", handleResize);
            try {
              instance?.dispose?.();
            } catch (error) {
              console.warn("Не удалось корректно завершить ECharts-визуализацию", error);
            }
          };
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Ошибка визуализации", error);
          setErrorMessage("Не удалось загрузить визуализацию");
        }
      }
    }

    void render();

    return () => {
      isCancelled = true;
      teardown?.();
    };
  }, [lib, spec, data, isReducedMotion]);

  const shouldRenderChart = Boolean(lib && spec && !errorMessage);

  const sectionClassName = useMemo(
    () =>
      ["rounded-xl border border-neutral-200 bg-white p-4 shadow-sm", className]
        .filter(Boolean)
        .join(" "),
    [className],
  );

  return (
    <section className={sectionClassName} data-motion={isReducedMotion ? "discrete" : "continuous"}>
      {title && <h2 className="text-lg font-medium text-neutral-900">{title}</h2>}
      <div className="relative mt-3 min-h-[220px]">
        <div ref={containerRef} className="h-full w-full" aria-hidden={!shouldRenderChart} />
        {!shouldRenderChart && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            {errorMessage ?? FALLBACK_MESSAGE}
          </div>
        )}
      </div>
    </section>
  );
}
