import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { enforceAdminRateLimit, resolveTelemetryExportRpm } from "@/lib/admin/rate-limit";
import { authorizeApi } from "@/lib/admin/rbac";
import { readAuditRecent } from "@/lib/ff/audit";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";

const ZIP_RECORD_LIMIT = 200_000;
const ZIP_SIZE_LIMIT = 25 * 1024 * 1024; // 25MB pre-compression
const ZIP_WARNING_RECORDS = 100_000;
const ZIP_WARNING_BYTES = 15 * 1024 * 1024; // 15MB

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

function parseFlagFilters(url: URL): Set<string> {
  const raw = [...url.searchParams.getAll("flag"), ...url.searchParams.getAll("flags")];
  const values = new Set<string>();
  for (const entry of raw) {
    for (const part of entry.split(/[\s,]+/)) {
      const trimmed = part.trim();
      if (trimmed) values.add(trimmed);
    }
  }
  return values;
}

function withinRange(ts: number | undefined, fromTs?: number, toTs?: number): boolean {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
  if (typeof fromTs === "number" && ts < fromTs) return false;
  if (typeof toTs === "number" && ts > toTs) return false;
  return true;
}

function matchesFlagFilter(row: TelemetryExportRow, flags: Set<string>): boolean {
  if (flags.size === 0) return true;
  const flag = row.flag?.trim();
  if (!flag) return false;
  return flags.has(flag);
}

function matchesAuditFlag(record: Record<string, unknown>, flags: Set<string>): boolean {
  if (flags.size === 0) return true;
  const single = typeof record.flag === "string" ? record.flag.trim() : "";
  if (single && flags.has(single)) return true;
  const list = Array.isArray((record as Record<string, unknown>).flags)
    ? ((record as Record<string, unknown>).flags as unknown[])
    : [];
  for (const item of list) {
    if (typeof item === "string" && flags.has(item.trim())) return true;
  }
  return false;
}

async function collectNdjson(
  basePath: string | undefined,
  filters: { fromTs?: number; toTs?: number },
): Promise<string[]> {
  if (!basePath) return [];
  const files = await listNdjsonFiles(basePath, { maxChunkCount: 0, maxChunkDays: 0 });
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    let content = "";
    try {
      content = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const tsValue = sanitizeNumber((parsed as Record<string, unknown>).ts);
      if (!withinRange(tsValue, filters.fromTs, filters.toTs)) continue;
      lines.push(JSON.stringify(parsed));
    }
  }
  return lines;
}

type ZipDatasetBreakdown = {
  telemetry: { records: number; bytes: number };
  vitals: { records: number; bytes: number };
  errors: { records: number; bytes: number };
  audit: { records: number; bytes: number };
};

function summarizeLines(lines: string[]): { records: number; bytes: number } {
  if (lines.length === 0) return { records: 0, bytes: 0 };
  const joined = `${lines.join("\n")}\n`;
  return {
    records: lines.length,
    bytes: Buffer.byteLength(joined, "utf8"),
  };
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
  if (fmtParam !== "ndjson" && fmtParam !== "csv" && fmtParam !== "zip") {
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
  const flagFilters = parseFlagFilters(url);

  const file = process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    content = "";
  }

  const hashSalt = process.env.TELEMETRY_HASH_SALT || "";
  const rows = parseTelemetry(content, hashSalt).filter((row) => {
    if (!withinRange(row.ts, fromTs, toTs)) return false;
    if (!matchesFlagFilter(row, flagFilters)) return false;
    return true;
  });

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

  if (fmtParam === "zip") {
    const telemetryLines = rows.map((row) => JSON.stringify(row));
    const vitalsLines = await collectNdjson(
      process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE,
      { fromTs, toTs },
    );
    const errorsLines = await collectNdjson(
      process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE,
      { fromTs, toTs },
    );
    const auditLines = readAuditRecent(ZIP_RECORD_LIMIT)
      .filter((record) => withinRange(record.timestamp, fromTs, toTs))
      .filter((record) =>
        matchesAuditFlag(record as unknown as Record<string, unknown>, flagFilters),
      )
      .map((record) => JSON.stringify(record));

    const telemetrySummary = summarizeLines(telemetryLines);
    const vitalsSummary = summarizeLines(vitalsLines);
    const errorsSummary = summarizeLines(errorsLines);
    const auditSummary = summarizeLines(auditLines);

    const totalRecords =
      telemetrySummary.records +
      vitalsSummary.records +
      errorsSummary.records +
      auditSummary.records;
    const totalBytes =
      telemetrySummary.bytes + vitalsSummary.bytes + errorsSummary.bytes + auditSummary.bytes;

    if (totalRecords === 0) {
      return auth.apply(new NextResponse(null, { status: 204 }));
    }

    if (totalRecords > ZIP_RECORD_LIMIT || totalBytes > ZIP_SIZE_LIMIT) {
      return auth.apply(
        NextResponse.json({ error: "Export exceeds safety limits" }, { status: 413 }),
      );
    }

    const metadata = {
      generatedAt: new Date().toISOString(),
      filters: {
        from: typeof fromTs === "number" ? fromTs : null,
        to: typeof toTs === "number" ? toTs : null,
        flags: Array.from(flagFilters),
      },
      totals: {
        records: totalRecords,
        bytes: totalBytes,
      },
      datasets: {
        telemetry: telemetrySummary,
        vitals: vitalsSummary,
        errors: errorsSummary,
        audit: auditSummary,
      },
    } satisfies {
      generatedAt: string;
      filters: { from: number | null; to: number | null; flags: string[] };
      totals: { records: number; bytes: number };
      datasets: ZipDatasetBreakdown;
    };

    const zip = new JSZip();
    if (telemetryLines.length > 0) {
      zip.file("telemetry.ndjson", `${telemetryLines.join("\n")}\n`);
    }
    if (vitalsLines.length > 0) {
      zip.file("vitals.ndjson", `${vitalsLines.join("\n")}\n`);
    }
    if (errorsLines.length > 0) {
      zip.file("errors.ndjson", `${errorsLines.join("\n")}\n`);
    }
    if (auditLines.length > 0) {
      zip.file("audit.ndjson", `${auditLines.join("\n")}\n`);
    }
    zip.file("metadata.json", `${JSON.stringify(metadata, null, 2)}\n`);
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const res = new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": "attachment; filename=telemetry-export.zip",
      },
    });

    if (totalRecords > ZIP_WARNING_RECORDS || totalBytes > ZIP_WARNING_BYTES) {
      res.headers.set("sv-telemetry-warning", "large-export");
    }

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
