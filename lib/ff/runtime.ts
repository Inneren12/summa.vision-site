import crypto from "node:crypto";

import type { RequestCorrelation } from "../metrics/correlation";

import { FileTelemetrySink } from "./runtime/file-telemetry";
import type { RuntimeLock } from "./runtime/lock";
import { SelfMetricsProvider, type SnapshotSummary } from "./runtime/self-metrics";
import { resolveStoreAdapter } from "./runtime/store-resolver";
import type { FlagStore, FlagSnapshot } from "./runtime/types";
import type { TelemetryEvent } from "./telemetry";

type TelemetrySink = { emit: (event: TelemetryEvent) => void };

type VitalDetails = {
  rating?: string;
  id?: string;
  startTime?: number;
  label?: string;
  delta?: number;
  navigationType?: string;
  attribution?: Record<string, unknown>;
  context?: RequestCorrelation;
  url?: string;
  sid?: string;
  aid?: string;
};

type MetricsProvider = {
  recordVital(snapshotId: string, metric: string, value: number, details?: VitalDetails): void;
  recordError(
    snapshotId: string,
    message: string | undefined,
    stack?: string,
    details?: {
      url?: string;
      filename?: string;
      sid?: string;
      aid?: string;
      context?: RequestCorrelation;
    },
  ): void;
  summarize(snapshotId?: string): SnapshotSummary[];
  hasData(snapshotId: string): boolean;
};

type RuntimeShape = {
  telemetrySink: TelemetrySink;
  store: FlagStore;
  metrics: MetricsProvider;
  lock: RuntimeLock;
  snapshot(): Promise<{ id: string; data: FlagSnapshot }>;
};

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

let runtime: RuntimeShape | null = null;

function resolveTelemetrySink(): TelemetrySink {
  const file = process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  const sink = new FileTelemetrySink(file);
  return {
    emit(event) {
      sink.emit(event);
    },
  };
}

function resolveMetricsProvider(): MetricsProvider {
  const provider = (process.env.METRICS_PROVIDER || "self").toLowerCase();
  const windowMs = Number(process.env.METRICS_WINDOW_MS || DEFAULT_WINDOW_MS);
  const vitalsFile = process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE;
  const errorsFile = process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE;
  if (provider === "memory") {
    return new SelfMetricsProvider(windowMs, undefined, undefined);
  }
  return new SelfMetricsProvider(windowMs, vitalsFile, errorsFile);
}

function computeSnapshotId(snapshot: FlagSnapshot): string {
  const hash = crypto.createHash("sha1");
  hash.update(JSON.stringify(snapshot));
  return hash.digest("hex");
}

function createDefaultRuntime(): RuntimeShape {
  const { store, lock } = resolveStoreAdapter();
  const telemetrySink = resolveTelemetrySink();
  const metrics = resolveMetricsProvider();
  return {
    store,
    telemetrySink,
    metrics,
    lock,
    async snapshot() {
      const data = await store.snapshot();
      return { id: computeSnapshotId(data), data };
    },
  } satisfies RuntimeShape;
}

export function FF(): RuntimeShape {
  if (!runtime) {
    runtime = createDefaultRuntime();
  }
  return runtime;
}

type ComposeOverrides = {
  telemetry?: TelemetrySink;
  store?: FlagStore;
  metrics?: MetricsProvider;
  lock?: RuntimeLock;
};

export function composeFFRuntime(overrides?: ComposeOverrides): RuntimeShape {
  const base = createDefaultRuntime();
  runtime = {
    telemetrySink: overrides?.telemetry ?? base.telemetrySink,
    store: overrides?.store ?? base.store,
    metrics: overrides?.metrics ?? base.metrics,
    lock: overrides?.lock ?? base.lock,
    async snapshot() {
      const store = overrides?.store ?? base.store;
      const data = await store.snapshot();
      return { id: computeSnapshotId(data), data };
    },
  } satisfies RuntimeShape;
  return runtime;
}

export function resetFFRuntime() {
  runtime = null;
}
