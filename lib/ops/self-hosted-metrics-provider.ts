import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { listNdjsonFiles } from "@/lib/metrics/ndjson";
import { loadErasureMatcher } from "@/lib/privacy/erasure";

const DEFAULT_RUNTIME_DIR = path.resolve(".runtime");
const DEFAULT_VITALS_FILE = path.join(DEFAULT_RUNTIME_DIR, "vitals.ndjson");
const DEFAULT_ERRORS_FILE = path.join(DEFAULT_RUNTIME_DIR, "errors.ndjson");
const WINDOW_CACHE_TTL_MS = 30 * 1000;

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

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof error === "object" && "code" in error;
}

function logWindowIoError(error: unknown, vitalsFile?: string, errorsFile?: string) {
  const files = [vitalsFile, errorsFile].filter((value): value is string => Boolean(value));
  const target = files.length > 0 ? files.join(", ") : "self-metrics files";
  console.warn(`[self-metrics] Failed to read ${target}`, error);
}

async function* readLines(filePaths: readonly string[]): AsyncIterable<string> {
  for (const filePath of filePaths) {
    let stream: ReturnType<typeof createReadStream> | undefined;
    try {
      stream = createReadStream(filePath, { encoding: "utf8" });
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          yield trimmed;
        }
      }
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        continue;
      }
      throw error;
    } finally {
      rl.close();
      stream?.destroy();
    }
  }
}

type MetricSamples = Map<string, number[]>;
type SnapshotMetrics = Map<string, MetricSamples>;
type SnapshotErrors = Map<string, number>;
type WindowData = { metrics: SnapshotMetrics; errors: SnapshotErrors };
type WindowCacheEntry = {
  expiresAt: number;
  promise?: Promise<WindowData>;
  value?: WindowData;
};

type SnapshotResolver =
  | ((flag: string, namespace: string) => Promise<readonly string[] | string | null>)
  | ((flag: string, namespace: string) => readonly string[] | string | null);

type Options = {
  windowMs?: number;
  vitalsFile?: string;
  errorsFile?: string;
  resolveSnapshotIds?: SnapshotResolver;
  maxChunkDays?: number;
  maxChunkCount?: number;
};

type ErasureMatcher = {
  isErased(candidate: {
    sid?: string | null;
    aid?: string | null;
    sessionId?: string | null;
    userId?: string | null;
  }): boolean;
};

async function parseVitals(
  filePaths: readonly string[],
  cutoff: number,
  matcher: ErasureMatcher,
): Promise<SnapshotMetrics> {
  const map: SnapshotMetrics = new Map();
  for await (const line of readLines(filePaths)) {
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
    const sid = typeof event.sid === "string" ? event.sid : undefined;
    const aid = typeof event.aid === "string" ? event.aid : undefined;
    const sessionId = typeof event.sessionId === "string" ? event.sessionId : undefined;
    if (!snapshotId || !metric || value === undefined || ts === undefined) continue;
    if (ts < cutoff) continue;
    if (matcher.isErased({ sid: sid ?? sessionId ?? null, aid, sessionId })) continue;
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
  filePaths: readonly string[],
  cutoff: number,
  matcher: ErasureMatcher,
): Promise<SnapshotErrors> {
  const map: SnapshotErrors = new Map();
  for await (const line of readLines(filePaths)) {
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
    const sid = typeof event.sid === "string" ? event.sid : undefined;
    const aid = typeof event.aid === "string" ? event.aid : undefined;
    const sessionId = typeof event.sessionId === "string" ? event.sessionId : undefined;
    if (!snapshotId || ts === undefined) continue;
    if (ts < cutoff) continue;
    if (matcher.isErased({ sid: sid ?? sessionId ?? null, aid, sessionId })) continue;
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
  private readonly maxChunkDays: number;
  private readonly maxChunkCount: number;
  private readonly windowCache = new Map<string, WindowCacheEntry>();

  constructor(options?: Options) {
    this.windowMs = Number.isFinite(options?.windowMs)
      ? Math.max(0, Number(options?.windowMs))
      : 15 * 60 * 1000;
    this.vitalsFile = options?.vitalsFile ?? DEFAULT_VITALS_FILE;
    this.errorsFile = options?.errorsFile ?? DEFAULT_ERRORS_FILE;
    this.resolver = options?.resolveSnapshotIds;
    this.maxChunkDays = Number.isFinite(options?.maxChunkDays)
      ? Math.max(0, Number(options?.maxChunkDays))
      : 14;
    this.maxChunkCount = Number.isFinite(options?.maxChunkCount)
      ? Math.max(0, Number(options?.maxChunkCount))
      : 12;
  }

  private getWindowCacheKey(span: number): string {
    const vitals = this.vitalsFile ?? DEFAULT_VITALS_FILE;
    const errors = this.errorsFile ?? DEFAULT_ERRORS_FILE;
    return `${span}:${vitals}:${errors}:${this.maxChunkDays}:${this.maxChunkCount}`;
  }

  private async loadWindow(windowMs?: number): Promise<WindowData> {
    const span =
      typeof windowMs === "number" && Number.isFinite(windowMs) && windowMs >= 0
        ? windowMs
        : this.windowMs;
    if (span === 0) {
      return { metrics: new Map(), errors: new Map() } satisfies WindowData;
    }
    const key = this.getWindowCacheKey(span);
    const now = Date.now();
    const cached = this.windowCache.get(key);
    if (cached && cached.expiresAt > now) {
      if (cached.value) {
        return cached.value;
      }
      if (cached.promise) {
        return cached.promise;
      }
    }

    const loadPromise: Promise<WindowData> = (async () => {
      try {
        const cutoff = Date.now() - span;
        const matcher = await loadErasureMatcher();
        const [vitalsFiles, errorFiles] = await Promise.all([
          listNdjsonFiles(this.vitalsFile, {
            maxChunkCount: this.maxChunkCount,
            maxChunkDays: this.maxChunkDays,
          }),
          listNdjsonFiles(this.errorsFile, {
            maxChunkCount: this.maxChunkCount,
            maxChunkDays: this.maxChunkDays,
          }),
        ]);
        const [metrics, errors] = await Promise.all([
          parseVitals(vitalsFiles, cutoff, matcher),
          parseErrors(errorFiles, cutoff, matcher),
        ]);
        const result: WindowData = { metrics, errors };
        this.windowCache.set(key, {
          value: result,
          expiresAt: Date.now() + WINDOW_CACHE_TTL_MS,
        });
        return result;
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "ENOENT") {
          logWindowIoError(error, this.vitalsFile, this.errorsFile);
        }
        const empty: WindowData = { metrics: new Map(), errors: new Map() };
        this.windowCache.set(key, {
          value: empty,
          expiresAt: Date.now() + WINDOW_CACHE_TTL_MS,
        });
        return empty;
      }
    })();

    this.windowCache.set(key, { promise: loadPromise, expiresAt: now + WINDOW_CACHE_TTL_MS });
    return loadPromise;
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
      return null;
    }
    return errorCount / sampleCount;
  }
}
