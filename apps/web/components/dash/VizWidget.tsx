"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { EmbedResult } from "vega-embed";

export type VizWidgetProps = {
  title?: string;
  /** Vega/Vega-Lite specification rendered via vega-embed. */
  spec?: Record<string, unknown> | null;
  /** Optional custom content rendered under the visualization. */
  children?: ReactNode;
};

export default function VizWidget({ title, spec, children }: VizWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !spec) {
      return undefined;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    element.innerHTML = "";

    void (async () => {
      try {
        const { default: embed } = await import("vega-embed");
        if (cancelled) {
          return;
        }

        const result = (await embed(element, spec as Record<string, unknown>, {
          actions: false,
        })) as unknown as EmbedResult;

        cleanup = () => {
          result?.finalize?.();
          result?.view?.finalize?.();
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("VizWidget: failed to render visualization", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      element.innerHTML = "";
    };
  }, [spec]);

  return (
    <section className="mb-4 rounded-xl border p-4">
      {title && <h2 className="mb-2 text-lg font-medium">{title}</h2>}
      {spec ? (
        <div ref={containerRef} className="min-h-[200px]" />
      ) : (
        (children ?? <div className="text-sm text-gray-500">Здесь будет график…</div>)
      )}
    </section>
  );
}
