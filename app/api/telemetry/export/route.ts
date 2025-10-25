import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { enforceAdminRateLimit, resolveTelemetryExportRpm } from "@/lib/admin/rate-limit";
import { authorizeApi } from "@/lib/admin/rbac";
import { readAuditRecent, type AuditRecord } from "@/lib/ff/audit";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";
const MAX_ZIP_RECORDS = 100_000;
const MAX_ZIP_BYTES = 25 * 1024 * 1024;
const ZIP_WARNING_THRESHOLD = 0.8;
const AUDIT_EXPORT_LIMIT = 1_000;

export const runtime = "nodejs";

type TelemetryExportEventType =
  | "flag_evaluated"
  | "exposure"
  | "exposure_shadow"
  | "override_set"
  | "rollout_step"
  | "rollout_blocked"
  | "kill_switch";

type TelemetryExportRow = {
  ts: number;
  event: TelemetryExportEventType;
  flag?: string;
  value?: string | number | boolean;
  source?: string;
  stableIdHash?: string;
  userHash?: string;
  userKeyHash?: string;
  evaluationTimeMs?: number;
  reason?: string;
  ttlSeconds?: number;
  instanceId?: string;
  rolloutStep?: string;
  blockedBy?: string;
};

const EVENT_TYPE_MAP: Record<string, TelemetryExportEventType> = {
  evaluation: "flag_evaluated",
  exposure: "exposure",
  exposure_shadow: "exposure_shadow",
  override_set: "override_set",
  rollout_step: "rollout_step",
  rollout_blocked: "rollout_blocked",
  kill_switch: "kill_switch",
};

const CSV_COLUMNS: Array<keyof TelemetryExportRow> = [
  "ts",
  "event",
  "flag",
  "value",
  "source",
  "stableIdHash",
  "userHash",
  "userKeyHash",
  "evaluationTimeMs",
  "reason",
  "ttlSeconds",
  "instanceId",
  "rolloutStep",
  "blockedBy",
];

function escapeCsvValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  const str = String(value).replace(/"/g, '""');
  if (/[",\n]/.test(str)) return `"${str}"`;
  return str;
}

function buildCsv(rows: TelemetryExportRow[]): string {
  if (rows.length === 0) return "";
  const columns = CSV_COLUMNS.filter((col) => rows.some((row) => typeof row[col] !== "undefined"));
  if (columns.length === 0) return "";
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((key) => escapeCsvValue(row[key])).join(","));
  }
  return lines.join("\n");
}

function hashPII(value: string, salt: string): string {
  const hash = crypto.createHash("sha256");
  if (salt) hash.update(salt);
  hash.update(value);
  return hash.digest("hex");
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(num)) return undefined;
  return num;
}

function parseTimestamp(value: unknown): number | undefined {
  const numeric = sanitizeNumber(value);
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeRow(raw: Record<string, unknown>, hashSalt: string): TelemetryExportRow | null {
  const tsValue = typeof raw.ts === "number" ? raw.ts : sanitizeNumber(raw.ts);
  if (typeof tsValue !== "number" || !Number.isFinite(tsValue)) {
    return null;
  }
  const typeValue = typeof raw.type === "string" ? raw.type : undefined;
  const mappedType = typeValue ? EVENT_TYPE_MAP[typeValue] : undefined;
  if (!mappedType) {
    return null;
  }

  const event: TelemetryExportRow = {
    ts: tsValue,
    event: mappedType,
  };

  const flag = sanitizeString(raw.flag);
  if (flag) event.flag = flag;

  if (
    typeof raw.value === "string" ||
    typeof raw.value === "number" ||
    typeof raw.value === "boolean"
  ) {
    event.value = raw.value as string | number | boolean;
  }

  const source = sanitizeString(raw.source);
  if (source) event.source = source;

  const stableId = sanitizeString(raw.stableId);
  if (stableId) {
    event.stableIdHash = hashPII(stableId, hashSalt);
  }

  const userId = sanitizeString(raw.userId);
  if (userId) {
    event.userHash = hashPII(userId, hashSalt);
  }

  const userKey = sanitizeString((raw.userKey ?? raw.user_key) as unknown);
  if (userKey) {
    event.userKeyHash = hashPII(userKey, hashSalt);
  }

  const evaluationTime = sanitizeNumber(raw.evaluationTime ?? raw.evaluationTimeMs);
  if (typeof evaluationTime === "number") {
    event.evaluationTimeMs = evaluationTime;
  }

  const reason = sanitizeString(raw.reason);
  if (reason) event.reason = reason;

  const ttlSeconds = sanitizeNumber(raw.ttlSeconds);
  if (typeof ttlSeconds === "number") event.ttlSeconds = ttlSeconds;

  const instanceId = sanitizeString(raw.instanceId);
  if (instanceId) event.instanceId = instanceId;

  const rolloutStep = sanitizeString((raw.rolloutStep ?? raw.step) as unknown);
  if (rolloutStep) event.rolloutStep = rolloutStep;

  const blockedBy = sanitizeString((raw.blockedBy ?? raw.blocked_by) as unknown);
  if (blockedBy) event.blockedBy = blockedBy;

  return event;
}

function parseTelemetry(ndjson: string, hashSalt: string): TelemetryExportRow[] {
  return ndjson
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })
    .map((row) => normalizeRow(row, hashSalt))
    .filter((row): row is TelemetryExportRow => row !== null);
}

type TimeParamResult = { ok: true; value?: number } | { ok: false };

function parseTimeParam(value: string | null): TimeParamResult {
  if (value === null) return { ok: true };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true };
  let parsed: number;
  if (/^\d+$/.test(trimmed)) {
    parsed = Number(trimmed);
  } else {
    parsed = Date.parse(trimmed);
  }
  if (!Number.isFinite(parsed)) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

type FlagFilter = Set<string> | null;

function resolveFlagFilter(params: URLSearchParams): FlagFilter {
  const values: string[] = [];
  for (const raw of params.getAll("flag")) {
    for (const part of raw.split(",")) {
      const normalized = part.trim();
      if (normalized) {
        values.push(normalized);
      }
    }
  }
  if (values.length === 0) {
    return null;
  }
  return new Set(values);
}

function matchesFlag(value: string | undefined, filter: FlagFilter): boolean {
  if (!filter) return true;
  if (!value) return false;
  return filter.has(value);
}

type RangeFilter = {
  fromTs?: number;
  toTs?: number;
};

type DatasetContent = {
  name: string;
  content: string;
  records: number;
  bytes: number;
};

function auditMatchesFlag(record: AuditRecord, filter: FlagFilter): boolean {
  if (!filter) return true;
  if ("flag" in record && typeof record.flag === "string") {
    return filter.has(record.flag);
  }
  if ("flags" in record && Array.isArray(record.flags)) {
    return record.flags.some((flag) => typeof flag === "string" && filter.has(flag));
  }
  return false;
}

function collectAuditDataset(filter: RangeFilter, flagFilter: FlagFilter): DatasetContent | null {
  const records = readAuditRecent(AUDIT_EXPORT_LIMIT);
  const lines: string[] = [];
  for (const entry of records) {
    const ts = parseTimestamp(entry.timestamp);
    if (typeof filter.fromTs === "number" && (typeof ts !== "number" || ts < filter.fromTs)) {
      continue;
    }
    if (typeof filter.toTs === "number" && (typeof ts !== "number" || ts > filter.toTs)) {
      continue;
    }
    if (!auditMatchesFlag(entry, flagFilter)) {
      continue;
    }
    lines.push(JSON.stringify(entry));
  }
  const content = lines.join("\n");
  return {
    name: "audit.ndjson",
    content,
    records: lines.length,
    bytes: Buffer.byteLength(content, "utf8"),
  } satisfies DatasetContent;
}

async function collectNdjsonDataset(
  baseFile: string,
  filter: RangeFilter,
  name: string,
): Promise<DatasetContent> {
  const files = await listNdjsonFiles(baseFile, { maxChunkCount: 0, maxChunkDays: 0 });
  const lines: string[] = [];
  for (const filePath of files) {
    let content = "";
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
    for (const rawLine of content.split("\n")) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue;
      }
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const ts = parseTimestamp(parsed?.ts);
      if (typeof filter.fromTs === "number" && (typeof ts !== "number" || ts < filter.fromTs)) {
        continue;
      }
      if (typeof filter.toTs === "number" && (typeof ts !== "number" || ts > filter.toTs)) {
        continue;
      }
      lines.push(trimmed);
    }
  }
  const content = lines.join("\n");
  return {
    name,
    content,
    records: lines.length,
    bytes: Buffer.byteLength(content, "utf8"),
  } satisfies DatasetContent;
}

async function prepareZipDatasets(
  rows: TelemetryExportRow[],
  range: RangeFilter,
  flagFilter: FlagFilter,
): Promise<{ datasets: DatasetContent[]; totalRecords: number; totalBytes: number }> {
  const datasets: DatasetContent[] = [];
  let totalRecords = 0;
  let totalBytes = 0;

  const telemetryLines = rows.map((row) => JSON.stringify(row));
  const telemetryContent = telemetryLines.join("\n");
  datasets.push({
    name: "telemetry.ndjson",
    content: telemetryContent,
    records: telemetryLines.length,
    bytes: Buffer.byteLength(telemetryContent, "utf8"),
  });

  const vitalsFile = process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE;
  const errorsFile = process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE;
  const vitals = await collectNdjsonDataset(vitalsFile, range, "vitals.ndjson");
  datasets.push(vitals);

  const errors = await collectNdjsonDataset(errorsFile, range, "errors.ndjson");
  datasets.push(errors);

  const audit = collectAuditDataset(range, flagFilter);
  if (audit) {
    datasets.push(audit);
  }

  for (const dataset of datasets) {
    totalRecords += dataset.records;
    totalBytes += dataset.bytes;
  }

  return { datasets, totalRecords, totalBytes };
}

export async function GET(req: Request) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const limit = resolveTelemetryExportRpm();
  const gate = await enforceAdminRateLimit({
    req,
    scope: "telemetry-export",
    rpm: limit,
    actor: { role: auth.role, session: auth.session },
  });
  if (!gate.ok) {
    return auth.apply(gate.response);
  }
  const url = new URL(req.url);
  const fmtParam = (url.searchParams.get("fmt") || "ndjson").toLowerCase();
  if (!["ndjson", "csv", "zip"].includes(fmtParam)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const fromParam = parseTimeParam(url.searchParams.get("from"));
  if (!fromParam.ok) {
    return NextResponse.json({ error: "Invalid from" }, { status: 400 });
  }
  const toParam = parseTimeParam(url.searchParams.get("to"));
  if (!toParam.ok) {
    return NextResponse.json({ error: "Invalid to" }, { status: 400 });
  }
  const fromTs = fromParam.value;
  const toTs = toParam.value;
  if (typeof fromTs === "number" && typeof toTs === "number" && fromTs > toTs) {
    return NextResponse.json({ error: "from must be ≤ to" }, { status: 400 });
  }

  const flagFilter = resolveFlagFilter(url.searchParams);
  const file = process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    content = "";
  }

  const hashSalt = process.env.TELEMETRY_HASH_SALT || "";
  const rows = parseTelemetry(content, hashSalt).filter((row) => {
    if (typeof fromTs === "number" && row.ts < fromTs) return false;
    if (typeof toTs === "number" && row.ts > toTs) return false;
    if (!matchesFlag(row.flag, flagFilter)) return false;
    return true;
  });

  if (fmtParam === "zip") {
    const range: RangeFilter = { fromTs, toTs };
    const { datasets, totalBytes, totalRecords } = await prepareZipDatasets(
      rows,
      range,
      flagFilter,
    );
    if (totalRecords === 0) {
      return auth.apply(new NextResponse(null, { status: 204 }));
    }
    if (totalRecords > MAX_ZIP_RECORDS || totalBytes > MAX_ZIP_BYTES) {
      const error = NextResponse.json(
        { error: "Selection exceeds export limits" },
        { status: 413 },
      );
      return auth.apply(error);
    }

    const zip = new JSZip();
    for (const dataset of datasets) {
      zip.file(dataset.name, dataset.content);
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const headers = new Headers({
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="telemetry-export.zip"',
      "x-telemetry-export-records": String(totalRecords),
    });
    if (buffer.length > 0) {
      headers.set("content-length", String(buffer.length));
    }
    if (
      totalBytes > MAX_ZIP_BYTES * ZIP_WARNING_THRESHOLD ||
      totalRecords > MAX_ZIP_RECORDS * ZIP_WARNING_THRESHOLD
    ) {
      headers.set("x-telemetry-export-warning", "Large selection approaching export limits");
    }
    const res = new NextResponse(buffer, { status: 200, headers });
    return auth.apply(res);
  }

  if (rows.length === 0) {
    return auth.apply(new NextResponse(null, { status: 204 }));
  }

  if (fmtParam === "csv") {
    const csv = buildCsv(rows);
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
      },
    });
    return auth.apply(res);
  }

  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  const res = new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  });
  return auth.apply(res);
}
