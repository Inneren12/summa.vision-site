import type { NextWebVitalsMetric } from "next/app";

function snapshotId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.body?.dataset.ffSnapshot || undefined;
}

function postMetric(url: string, payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
      return;
    }
    if (typeof fetch === "undefined") return;
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* noop */
    });
  } catch {
    /* ignore */
  }
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const id = snapshotId();
  if (!id) return;

  // NextWebVitalsMetric не объявляет delta / navigationType / rating, но web-vitals их
  // прокидывает. Забираем их опционально и не ломаем типы.
  const metricWithOptionals = metric as NextWebVitalsMetric & {
    rating?: string;
    delta?: number;
    navigationType?: string;
    attribution?: Record<string, unknown>;
  };

  postMetric("/api/metrics/vitals", {
    snapshotId: id,
    metric: metric.name,
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
