import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";

import { NextResponse } from "next/server";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";

type TelemetryExportEventType =
  | "flag_evaluated"
  | "exposure"
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fmtParam = (url.searchParams.get("fmt") || "ndjson").toLowerCase();
  if (fmtParam !== "ndjson" && fmtParam !== "csv") {
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
    return true;
  });

  if (fmtParam === "csv") {
    const csv = buildCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
      },
    });
  }

  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  });
}
