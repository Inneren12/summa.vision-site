import fs from "node:fs/promises";
import path from "node:path";

import {
  isIdentifierErased,
  loadErasureIndex,
  type PrivacyErasureIndex,
  type PrivacyIdentifierSet,
} from "@/lib/privacy/erasure";

const DEFAULT_RUNTIME_DIR = path.resolve(".runtime");
const DEFAULT_VITALS_FILE = path.join(DEFAULT_RUNTIME_DIR, "vitals.ndjson");
const DEFAULT_ERRORS_FILE = path.join(DEFAULT_RUNTIME_DIR, "errors.ndjson");

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[clamped];
}

async function readLines(filePath: string | undefined): Promise<string[]> {
  if (!filePath) return [];
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

type MetricSamples = Map<string, number[]>;
type SnapshotMetrics = Map<string, MetricSamples>;
type SnapshotErrors = Map<string, number>;

type SnapshotResolver =
  | ((flag: string, namespace: string) => Promise<readonly string[] | string | null>)
  | ((flag: string, namespace: string) => readonly string[] | string | null);

type Options = {
  windowMs?: number;
  vitalsFile?: string;
  errorsFile?: string;
  resolveSnapshotIds?: SnapshotResolver;
};

function extractIdentifiers(event: Record<string, unknown>): PrivacyIdentifierSet {
  const sid = typeof event.sid === "string" ? event.sid.trim() : undefined;
  const aid = typeof event.aid === "string" ? event.aid.trim() : undefined;
  const userId = typeof event.userId === "string" ? event.userId.trim() : undefined;
  return { sid: sid || undefined, aid: aid || undefined, userId: userId || undefined };
}

async function parseVitals(
  filePath: string | undefined,
  cutoff: number,
  erasures: PrivacyErasureIndex,
): Promise<SnapshotMetrics> {
  const map: SnapshotMetrics = new Map();
  const lines = await readLines(filePath);
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const event = parsed as Record<string, unknown>;
    const snapshotId = typeof event.snapshotId === "string" ? event.snapshotId : undefined;
    const metric = typeof event.metric === "string" ? event.metric : undefined;
    const value = isFiniteNumber(event.value) ? (event.value as number) : undefined;
    const ts = isFiniteNumber(event.ts) ? (event.ts as number) : undefined;
    if (!snapshotId || !metric || value === undefined || ts === undefined) continue;
    if (isIdentifierErased(erasures, extractIdentifiers(event))) continue;
    if (ts < cutoff) continue;
    if (!map.has(snapshotId)) {
      map.set(snapshotId, new Map());
    }
    const metrics = map.get(snapshotId)!;
    if (!metrics.has(metric)) {
      metrics.set(metric, []);
    }
    metrics.get(metric)!.push(value);
  }
  return map;
}

async function parseErrors(
  filePath: string | undefined,
  cutoff: number,
  erasures: PrivacyErasureIndex,
): Promise<SnapshotErrors> {
  const map: SnapshotErrors = new Map();
  const lines = await readLines(filePath);
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const event = parsed as Record<string, unknown>;
    const snapshotId = typeof event.snapshotId === "string" ? event.snapshotId : undefined;
    const ts = isFiniteNumber(event.ts) ? (event.ts as number) : undefined;
    if (!snapshotId || ts === undefined) continue;
    if (isIdentifierErased(erasures, extractIdentifiers(event))) continue;
    if (ts < cutoff) continue;
    map.set(snapshotId, (map.get(snapshotId) ?? 0) + 1);
  }
  return map;
}

async function resolveIds(
  resolver: SnapshotResolver | undefined,
  flag: string,
  namespace: string,
): Promise<string[]> {
  if (!resolver) {
    return [];
  }
  const result = await resolver(flag, namespace);
  if (!result) return [];
  if (Array.isArray(result)) return result.filter((id): id is string => typeof id === "string");
  if (typeof result === "string" && result) return [result];
  return [];
}

export class SelfHostedMetricsProvider {
  private readonly windowMs: number;
  private readonly vitalsFile?: string;
  private readonly errorsFile?: string;
  private readonly resolver?: SnapshotResolver;

  constructor(options?: Options) {
    this.windowMs = Number.isFinite(options?.windowMs)
      ? Math.max(0, Number(options?.windowMs))
      : 15 * 60 * 1000;
    this.vitalsFile = options?.vitalsFile ?? DEFAULT_VITALS_FILE;
    this.errorsFile = options?.errorsFile ?? DEFAULT_ERRORS_FILE;
    this.resolver = options?.resolveSnapshotIds;
  }

  private async loadWindow(
    windowMs?: number,
  ): Promise<{ metrics: SnapshotMetrics; errors: SnapshotErrors }> {
    const span =
      typeof windowMs === "number" && Number.isFinite(windowMs) && windowMs >= 0
        ? windowMs
        : this.windowMs;
    if (span === 0) {
      return { metrics: new Map(), errors: new Map() };
    }
    const now = Date.now();
    const cutoff = now - span;
    const erasures = await loadErasureIndex();
    const [metrics, errors] = await Promise.all([
      parseVitals(this.vitalsFile, cutoff, erasures),
      parseErrors(this.errorsFile, cutoff, erasures),
    ]);
    return { metrics, errors };
  }

  private async lookupSnapshots(flag: string, namespace: string): Promise<string[]> {
    if (this.resolver) {
      return resolveIds(this.resolver, flag, namespace);
    }
    if (typeof namespace === "string" && namespace.length > 0) {
      return [namespace];
    }
    return [];
  }

  async getWebVital(
    metric: "CLS" | "INP",
    flag: string,
    namespace: string,
    windowMs?: number,
  ): Promise<number | null> {
    const snapshotIds = await this.lookupSnapshots(flag, namespace);
    if (snapshotIds.length === 0) {
      return null;
    }
    const { metrics } = await this.loadWindow(windowMs);
    const values: number[] = [];
    for (const id of snapshotIds) {
      const perMetric = metrics.get(id)?.get(metric);
      if (perMetric) {
        values.push(...perMetric);
      }
    }
    if (values.length === 0) {
      return null;
    }
    return percentile(values, 75);
  }

  async getErrorRate(flag: string, namespace: string, windowMs?: number): Promise<number | null> {
    const snapshotIds = await this.lookupSnapshots(flag, namespace);
    if (snapshotIds.length === 0) {
      return null;
    }
    const { metrics, errors } = await this.loadWindow(windowMs);
    let sampleCount = 0;
    let errorCount = 0;
    let hasData = false;
    for (const id of snapshotIds) {
      const perMetric = metrics.get(id);
      if (perMetric) {
        hasData = true;
        for (const arr of perMetric.values()) {
          sampleCount += arr.length;
        }
      }
      if (errors.has(id)) {
        hasData = true;
        errorCount += errors.get(id) ?? 0;
      }
    }
    if (!hasData) {
      return null;
    }
    if (sampleCount === 0) {
      return errorCount > 0 ? 1 : 0;
    }
    return errorCount / sampleCount;
  }
}
