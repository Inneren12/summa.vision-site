import type { NextWebVitalsMetric } from "next/app";

import { getClientEventBuffer } from "./telemetry/client-buffer";

function snapshotId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.body?.dataset.ffSnapshot || undefined;
}

function buffer(): ReturnType<typeof getClientEventBuffer> | undefined {
  const id = snapshotId();
  if (!id) return undefined;
  return getClientEventBuffer({ url: "/api/vitals", snapshotId: id });
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const metricsBuffer = buffer();
  if (!metricsBuffer) return;

  // NextWebVitalsMetric не объявляет delta / navigationType / rating, но web-vitals их
  // прокидывает. Забираем их опционально и не ломаем типы.
  const metricWithOptionals = metric as NextWebVitalsMetric & {
    rating?: string;
    delta?: number;
    navigationType?: string;
    attribution?: Record<string, unknown>;
  };
  metricsBuffer.enqueue({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    startTime: metric.startTime,
    label: metric.label,
    rating: metricWithOptionals.rating,
    delta: metricWithOptionals.delta,
    navigationType: metricWithOptionals.navigationType,
    attribution: metricWithOptionals.attribution,
  });
}
