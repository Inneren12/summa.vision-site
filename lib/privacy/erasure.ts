import fs from "node:fs/promises";
import path from "node:path";

export type PrivacyIdentifierSet = {
  sid?: string;
  aid?: string;
  userId?: string;
};

export type PrivacyErasureRecord = PrivacyIdentifierSet & {
  at: number;
  source?: string;
};

export type PrivacyErasureIndex = {
  entries: PrivacyErasureRecord[];
  sid: Map<string, PrivacyErasureRecord>;
  aid: Map<string, PrivacyErasureRecord>;
  userId: Map<string, PrivacyErasureRecord>;
};

export type PurgeSummary = {
  file: string | null;
  removed: number;
  purged: boolean;
  skipped: boolean;
  reason?: string;
  size?: number;
};

const DEFAULT_RUNTIME_DIR = path.resolve(".runtime");
const DEFAULT_ERASURE_FILE = path.join(DEFAULT_RUNTIME_DIR, "privacy.erasure.ndjson");
const DEFAULT_VITALS_FILE = path.join(DEFAULT_RUNTIME_DIR, "vitals.ndjson");
const DEFAULT_ERRORS_FILE = path.join(DEFAULT_RUNTIME_DIR, "errors.ndjson");
const DEFAULT_TELEMETRY_FILE = path.join(DEFAULT_RUNTIME_DIR, "telemetry.ndjson");

const MAX_PURGE_BYTES = 50 * 1024 * 1024; // 50 MB

type AppendOptions = {
  filePath?: string;
  source?: string;
  timestamp?: number;
};

type PurgeOptions = {
  thresholdBytes?: number;
};

const LINE_SPLIT = /\r?\n/;

function resolveFile(envKey: string, fallback: string): string {
  const raw = process.env[envKey];
  if (raw && raw.trim()) {
    return path.resolve(raw.trim());
  }
  return fallback;
}

export function resolveErasureFilePath(filePath?: string): string {
  if (filePath) {
    return path.resolve(filePath);
  }
  return resolveFile("PRIVACY_ERASURE_FILE", DEFAULT_ERASURE_FILE);
}

export function resolveVitalsFilePath(): string {
  return resolveFile("METRICS_VITALS_FILE", DEFAULT_VITALS_FILE);
}

export function resolveErrorsFilePath(): string {
  return resolveFile("METRICS_ERRORS_FILE", DEFAULT_ERRORS_FILE);
}

export function resolveTelemetryFilePath(): string {
  return resolveFile("TELEMETRY_FILE", DEFAULT_TELEMETRY_FILE);
}

function normalize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeIdentifiers(ids: PrivacyIdentifierSet): PrivacyIdentifierSet {
  return {
    sid: normalize(ids.sid),
    aid: normalize(ids.aid),
    userId: normalize(ids.userId),
  };
}

export function hasIdentifiers(ids: PrivacyIdentifierSet): boolean {
  return Boolean(ids.sid || ids.aid || ids.userId);
}

export async function appendErasureRecord(
  ids: PrivacyIdentifierSet,
  options?: AppendOptions,
): Promise<PrivacyErasureRecord | null> {
  const normalized = normalizeIdentifiers(ids);
  if (!hasIdentifiers(normalized)) {
    return null;
  }
  const record: PrivacyErasureRecord = {
    ...normalized,
    at: Number.isFinite(options?.timestamp) ? Number(options?.timestamp) : Date.now(),
    source: options?.source,
  };
  const file = resolveErasureFilePath(options?.filePath);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

async function readLines(file: string): Promise<string[]> {
  try {
    const content = await fs.readFile(file, "utf8");
    return content
      .split(LINE_SPLIT)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readErasureRegistry(filePath?: string): Promise<PrivacyErasureRecord[]> {
  const file = resolveErasureFilePath(filePath);
  const lines = await readLines(file);
  const records: PrivacyErasureRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as PrivacyErasureRecord;
      const normalized = normalizeIdentifiers(parsed);
      if (!hasIdentifiers(normalized)) {
        continue;
      }
      records.push({
        ...normalized,
        at: Number.isFinite(parsed.at) ? Number(parsed.at) : Date.now(),
        source: parsed.source,
      });
    } catch {
      // ignore malformed entries
    }
  }
  return records;
}

export function buildErasureIndex(entries: PrivacyErasureRecord[]): PrivacyErasureIndex {
  const sorted = entries.slice().sort((a, b) => a.at - b.at);
  const index: PrivacyErasureIndex = {
    entries: sorted,
    sid: new Map(),
    aid: new Map(),
    userId: new Map(),
  };
  for (const entry of sorted) {
    if (entry.sid) {
      index.sid.set(entry.sid, entry);
    }
    if (entry.aid) {
      index.aid.set(entry.aid, entry);
    }
    if (entry.userId) {
      index.userId.set(entry.userId, entry);
    }
  }
  return index;
}

export async function loadErasureIndex(filePath?: string): Promise<PrivacyErasureIndex> {
  const entries = await readErasureRegistry(filePath);
  return buildErasureIndex(entries);
}

export function isIdentifierErased(index: PrivacyErasureIndex, ids: PrivacyIdentifierSet): boolean {
  const normalized = normalizeIdentifiers(ids);
  if (normalized.sid && index.sid.has(normalized.sid)) return true;
  if (normalized.aid && index.aid.has(normalized.aid)) return true;
  if (normalized.userId && index.userId.has(normalized.userId)) return true;
  return false;
}

function extractIdentifiers(payload: unknown): PrivacyIdentifierSet {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const record = payload as Record<string, unknown>;
  const sid = normalize(record.sid ?? record.sessionId ?? record.stableId);
  const aid = normalize(record.aid ?? record.accountId ?? record.ff_aid ?? record.sv_aid);
  const userId = normalize(record.userId);
  return { sid, aid, userId };
}

function shouldRemove(
  normalizedTarget: PrivacyIdentifierSet,
  candidate: PrivacyIdentifierSet,
): boolean {
  if (normalizedTarget.sid && candidate.sid && normalizedTarget.sid === candidate.sid) {
    return true;
  }
  if (normalizedTarget.aid && candidate.aid && normalizedTarget.aid === candidate.aid) {
    return true;
  }
  if (normalizedTarget.userId && candidate.userId && normalizedTarget.userId === candidate.userId) {
    return true;
  }
  return false;
}

export async function purgeNdjsonFile(
  filePath: string | undefined,
  ids: PrivacyIdentifierSet,
  options?: PurgeOptions,
): Promise<PurgeSummary> {
  const normalized = normalizeIdentifiers(ids);
  const file = filePath ? path.resolve(filePath) : null;
  if (!file || !hasIdentifiers(normalized)) {
    return { file: file ?? null, removed: 0, purged: false, skipped: true, reason: "no_match" };
  }
  const threshold = Number.isFinite(options?.thresholdBytes)
    ? Number(options?.thresholdBytes)
    : MAX_PURGE_BYTES;
  try {
    const stats = await fs.stat(file);
    if (stats.size > threshold) {
      return {
        file,
        removed: 0,
        purged: false,
        skipped: true,
        reason: "over_threshold",
        size: stats.size,
      } satisfies PurgeSummary;
    }
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(LINE_SPLIT);
    const kept: string[] = [];
    let removed = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const candidate = extractIdentifiers(parsed);
        if (shouldRemove(normalized, candidate)) {
          removed += 1;
          continue;
        }
      } catch {
        // keep malformed lines
      }
      kept.push(trimmed);
    }
    if (removed > 0) {
      const payload = kept.length > 0 ? `${kept.join("\n")}\n` : "";
      await fs.writeFile(file, payload, "utf8");
    }
    return { file, removed, purged: removed > 0, skipped: false, size: stats.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        file,
        removed: 0,
        purged: false,
        skipped: true,
        reason: "missing",
      } satisfies PurgeSummary;
    }
    throw error;
  }
}

export async function purgeTelemetryFiles(
  ids: PrivacyIdentifierSet,
  options?: PurgeOptions,
): Promise<{ vitals: PurgeSummary; errors: PurgeSummary; telemetry: PurgeSummary }> {
  const vitalsFile = resolveVitalsFilePath();
  const errorsFile = resolveErrorsFilePath();
  const telemetryFile = resolveTelemetryFilePath();
  const [vitals, errors, telemetry] = await Promise.all([
    purgeNdjsonFile(vitalsFile, ids, options),
    purgeNdjsonFile(errorsFile, ids, options),
    purgeNdjsonFile(telemetryFile, ids, options),
  ]);
  return { vitals, errors, telemetry };
}

export function lookupErasure(
  index: PrivacyErasureIndex,
  ids: PrivacyIdentifierSet,
): {
  sid?: PrivacyErasureRecord;
  aid?: PrivacyErasureRecord;
  userId?: PrivacyErasureRecord;
} {
  const normalized = normalizeIdentifiers(ids);
  return {
    sid: normalized.sid ? index.sid.get(normalized.sid) : undefined,
    aid: normalized.aid ? index.aid.get(normalized.aid) : undefined,
    userId: normalized.userId ? index.userId.get(normalized.userId) : undefined,
  };
}

export function summarizeIdentifiers(ids: PrivacyIdentifierSet): PrivacyIdentifierSet {
  const normalized = normalizeIdentifiers(ids);
  return {
    sid: normalized.sid,
    aid: normalized.aid,
    userId: normalized.userId,
  };
}
