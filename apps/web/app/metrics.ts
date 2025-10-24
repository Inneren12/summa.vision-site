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
  postMetric("/api/metrics/vitals", {
    snapshotId: id,
    metric: metric.name,
    value: metric.value,
    rating: (metric as { rating?: string }).rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
    id: metric.id,
  });
}
