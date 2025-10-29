"use client";
import type { ReactNode } from "react";

export type VizWidgetProps = {
  title?: string;
  children?: ReactNode;
};

export default function VizWidget({ title, children }: VizWidgetProps) {
  return (
    <section className="rounded-xl border p-4 mb-4">
      {title && <h2 className="text-lg font-medium mb-2">{title}</h2>}
      {children ?? <div className="text-sm text-gray-500">Здесь будет график…</div>}
    </section>
  );
}
