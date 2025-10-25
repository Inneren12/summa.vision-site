import fs from "node:fs";
import path from "node:path";

import { withCorrelationDefaults, type RequestCorrelation } from "../../metrics/correlation";

function now(): number {
  return Date.now();
}

type VitalEvent = {
  snapshotId: string;
  metric: string;
  value: number;
  rating?: string;
  id?: string;
  startTime?: number;
  label?: string;
  delta?: number;
  navigationType?: string;
  attribution?: Record<string, unknown>;
  url?: string;
  sid?: string;
  aid?: string;
  ts: number;
  requestId: string | null;
  sessionId: string | null;
  namespace: string;
};

type ErrorEvent = {
  snapshotId: string;
  message?: string;
  stack?: string;
  url?: string;
  filename?: string;
  sid?: string;
  aid?: string;
  ts: number;
  requestId: string | null;
  sessionId: string | null;
  namespace: string;
};

export type SummaryMetric = {
  p75: number;
  samples: number;
};

export type SnapshotSummary = {
  snapshotId: string;
  metrics: Record<string, SummaryMetric>;
  errorRate: number;
  errorCount: number;
  sampleCount: number;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function appendNdjson(filePath: string | undefined, payload: unknown): Promise<void> {
  if (!filePath) return;
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

export class SelfMetricsProvider {
  private vitals: VitalEvent[] = [];
  private errors: ErrorEvent[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly windowMs: number,
    private readonly vitalsFile?: string,
    private readonly errorsFile?: string,
  ) {}

  recordVital(
    snapshotId: string,
    metric: string,
    value: number,
    details?: {
      rating?: string;
      id?: string;
      startTime?: number;
      label?: string;
      delta?: number;
      navigationType?: string;
      attribution?: Record<string, unknown>;
      context?: RequestCorrelation;
    },
  ) {
    const correlation = withCorrelationDefaults(details?.context);
    const event: VitalEvent = {
      snapshotId,
      metric,
      value,
      rating: details?.rating,
      id: details?.id,
      startTime: details?.startTime,
      label: details?.label,
      delta: details?.delta,
      navigationType: details?.navigationType,
      attribution: details?.attribution,
      url: details?.url,
      sid: details?.sid,
      aid: details?.aid,
      ts: now(),
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      namespace: correlation.namespace,
    };
    this.vitals.push(event);
    if (this.vitalsFile) {
      this.enqueue(async () => {
        await appendNdjson(this.vitalsFile, event);
      });
    }
    this.prune();
  }

  recordError(snapshotId: string, message: string, stack?: string, context?: RequestCorrelation) {
    const correlation = withCorrelationDefaults(context);
    const event: ErrorEvent = {
      snapshotId,
      message,
      stack,
      ts: now(),
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      namespace: correlation.namespace,
    };
    this.errors.push(event);
    if (this.errorsFile) {
      this.enqueue(async () => {
        await appendNdjson(this.errorsFile, event);
      });
    }
    this.prune();
  }

  private prune() {
    const cutoff = now() - this.windowMs;
    this.vitals = this.vitals.filter((event) => event.ts >= cutoff);
    this.errors = this.errors.filter((event) => event.ts >= cutoff);
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch(() => undefined);
  }

  summarize(snapshotId?: string): SnapshotSummary[] {
    this.prune();
    const sampleMap = new Map<string, Map<string, number[]>>();
    const errorCount = new Map<string, number>();

    for (const event of this.vitals) {
      if (snapshotId && event.snapshotId !== snapshotId) continue;
      if (!sampleMap.has(event.snapshotId)) {
        sampleMap.set(event.snapshotId, new Map());
      }
      const map = sampleMap.get(event.snapshotId)!;
      if (!map.has(event.metric)) {
        map.set(event.metric, []);
      }
      map.get(event.metric)!.push(event.value);
    }

    for (const event of this.errors) {
      if (snapshotId && event.snapshotId !== snapshotId) continue;
      errorCount.set(event.snapshotId, (errorCount.get(event.snapshotId) ?? 0) + 1);
    }

    const summaries: SnapshotSummary[] = [];
    const snapshotIds = new Set<string>([...sampleMap.keys(), ...errorCount.keys()]);
    for (const id of snapshotIds) {
      const metrics = sampleMap.get(id) ?? new Map();
      const metricsSummary: Record<string, SummaryMetric> = {};
      let totalSamples = 0;
      for (const [metricName, values] of metrics.entries()) {
        totalSamples += values.length;
        metricsSummary[metricName] = { p75: percentile(values, 75), samples: values.length };
      }
      const errors = errorCount.get(id) ?? 0;
      const rate = totalSamples === 0 ? (errors > 0 ? 1 : 0) : errors / totalSamples;
      summaries.push({
        snapshotId: id,
        metrics: metricsSummary,
        errorRate: rate,
        errorCount: errors,
        sampleCount: totalSamples,
      });
    }

    return summaries.sort((a, b) => a.snapshotId.localeCompare(b.snapshotId));
  }

  hasData(snapshotId: string): boolean {
    this.prune();
    return this.vitals.some((event) => event.snapshotId === snapshotId);
  }
}
