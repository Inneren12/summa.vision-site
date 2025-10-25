import "server-only";

import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { logAdminAction } from "@/lib/ff/audit";
import { sanitizeUserId } from "@/lib/ff/stable-id";
import { correlationFromRequest } from "@/lib/metrics/correlation";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";
import { readIdentifiers } from "@/lib/metrics/privacy";

export const runtime = "nodejs";

const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";
const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const ROLE_HEADER = "x-ff-console-role";
const MAX_EXPORT_RECORDS = 100_000;
const MAX_EXPORT_BYTES = 25 * 1024 * 1024; // 25MB pre-compression

const DATASETS = [
  { name: "vitals", env: "METRICS_VITALS_FILE", defaultPath: DEFAULT_VITALS_FILE },
  { name: "errors", env: "METRICS_ERRORS_FILE", defaultPath: DEFAULT_ERRORS_FILE },
  { name: "telemetry", env: "TELEMETRY_FILE", defaultPath: DEFAULT_TELEMETRY_FILE },
] as const;

type IdentifierQuery = {
  sid?: string;
  aid?: string;
  userId?: string;
  stableId?: string;
};

type IdentifierFilter = {
  sid: Set<string>;
  aid: Set<string>;
  userId: Set<string>;
};

class ExportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportLimitError";
  }
}

function coerceParam(value: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRole(role: string | null): "admin" | "ops" | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin" || normalized === "ops") {
    return normalized;
  }
  return null;
}

function anonymize(value: string | undefined): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildFilter(ids: IdentifierQuery): IdentifierFilter {
  const sid = new Set<string>();
  const aid = new Set<string>();
  const userId = new Set<string>();
  if (ids.sid) {
    sid.add(ids.sid);
  }
  if (ids.stableId) {
    sid.add(ids.stableId);
  }
  if (ids.aid) {
    aid.add(ids.aid);
  }
  if (ids.userId) {
    userId.add(ids.userId);
  }
  return { sid, aid, userId } satisfies IdentifierFilter;
}

function matchesIdentifiers(event: Record<string, unknown>, filter: IdentifierFilter): boolean {
  if (filter.sid.size > 0) {
    const sid = typeof event.sid === "string" ? event.sid : undefined;
    const sessionId = typeof event.sessionId === "string" ? event.sessionId : undefined;
    const stableId = typeof event.stableId === "string" ? event.stableId : undefined;
    if (
      (sid && filter.sid.has(sid)) ||
      (sessionId && filter.sid.has(sessionId)) ||
      (stableId && filter.sid.has(stableId))
    ) {
      return true;
    }
  }
  if (filter.aid.size > 0) {
    const aid = typeof event.aid === "string" ? event.aid : undefined;
    const ffAid =
      typeof (event as Record<string, unknown>)["ff_aid"] === "string"
        ? ((event as Record<string, unknown>)["ff_aid"] as string)
        : undefined;
    if ((aid && filter.aid.has(aid)) || (ffAid && filter.aid.has(ffAid))) {
      return true;
    }
  }
  if (filter.userId.size > 0) {
    const userId = typeof event.userId === "string" ? event.userId : undefined;
    if (userId && filter.userId.has(userId)) {
      return true;
    }
  }
  return false;
}

async function* readLines(filePath: string): AsyncIterable<string> {
  let stream: ReturnType<typeof createReadStream> | undefined;
  try {
    stream = createReadStream(filePath, { encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  } finally {
    rl.close();
    stream?.destroy();
  }
}

async function collectDataset(
  filePaths: readonly string[],
  filter: IdentifierFilter,
): Promise<{ lines: string[]; records: number; bytes: number }> {
  const lines: string[] = [];
  let records = 0;
  let bytes = 0;
  for (const filePath of filePaths) {
    const resolved = path.resolve(filePath);
    for await (const line of readLines(resolved)) {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!matchesIdentifiers(parsed, filter)) {
        continue;
      }
      lines.push(line);
      records += 1;
      bytes += Buffer.byteLength(line, "utf8") + 1;
      if (records > MAX_EXPORT_RECORDS) {
        throw new ExportLimitError("Too many records");
      }
      if (bytes > MAX_EXPORT_BYTES) {
        throw new ExportLimitError("Export exceeds size limit");
      }
    }
  }
  return { lines, records, bytes };
}

async function gatherDatasets(ids: IdentifierQuery) {
  const filter = buildFilter(ids);
  const summaries = [] as Array<{ name: string; lines: string[]; records: number; bytes: number }>;
  for (const dataset of DATASETS) {
    const baseFile = process.env[dataset.env] || dataset.defaultPath;
    const files = await listNdjsonFiles(baseFile, { maxChunkCount: 0, maxChunkDays: 0 });
    const summary = await collectDataset(files, filter);
    summaries.push({ name: dataset.name, ...summary });
  }
  return summaries;
}

function deriveQueryIdentifiers(
  req: Request,
  role: "admin" | "ops" | null,
): {
  ids: IdentifierQuery;
  actor: "admin" | "ops" | "self";
  error?: Response;
} {
  const url = new URL(req.url);
  const params = url.searchParams;
  const sid =
    coerceParam(params.get("sid")) ||
    coerceParam(params.get("sv_id")) ||
    coerceParam(params.get("sessionId"));
  const aid =
    coerceParam(params.get("aid")) ||
    coerceParam(params.get("ff_aid")) ||
    coerceParam(params.get("sv_aid"));
  const stableId = coerceParam(params.get("stableId"));
  const rawUserId = coerceParam(params.get("userId"));

  if (role) {
    let userId: string | undefined;
    if (rawUserId) {
      const normalized = sanitizeUserId(rawUserId);
      if (!normalized) {
        return {
          ids: {},
          actor: role,
          error: NextResponse.json({ error: "Invalid userId" }, { status: 400 }),
        };
      }
      userId = normalized;
    }
    const ids: IdentifierQuery = { sid, aid, userId, stableId };
    if (!ids.sid && !ids.aid && !ids.userId && !ids.stableId) {
      return {
        ids,
        actor: role,
        error: NextResponse.json({ error: "At least one identifier is required" }, { status: 400 }),
      };
    }
    return { ids, actor: role };
  }

  if (rawUserId) {
    return {
      ids: {},
      actor: "self",
      error: NextResponse.json({ error: "userId export requires elevated role" }, { status: 403 }),
    };
  }

  const cookies = readIdentifiers(req.headers);
  const ids: IdentifierQuery = {
    sid: sid ?? cookies.sid,
    aid: aid ?? cookies.aid,
    stableId,
  };
  if (!ids.sid && !ids.aid) {
    return {
      ids,
      actor: "self",
      error: NextResponse.json({ error: "Missing identifiers" }, { status: 400 }),
    };
  }
  return { ids, actor: "self" };
}

export async function GET(req: Request) {
  const role = normalizeRole(req.headers.get(ROLE_HEADER));
  const { ids, actor, error } = deriveQueryIdentifiers(req, role);
  if (error) {
    return error;
  }

  try {
    const datasets = await gatherDatasets(ids);
    const totalRecords = datasets.reduce((sum, entry) => sum + entry.records, 0);

    const zip = new JSZip();
    for (const dataset of datasets) {
      const content = dataset.lines.length > 0 ? `${dataset.lines.join("\n")}\n` : "";
      zip.file(`${dataset.name}.ndjson`, content);
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const correlation = correlationFromRequest(req);
    logAdminAction({
      timestamp: Date.now(),
      actor,
      action: "privacy_export",
      identifiers: {
        sid: anonymize(ids.sid),
        aid: anonymize(ids.aid),
        userId: anonymize(ids.userId),
        stableId: anonymize(ids.stableId),
      },
      recordCount: totalRecords,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      requestNamespace: correlation.namespace,
    });

    const filename = `privacy-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    const response = new NextResponse(buffer, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        "content-length": String(buffer.length),
      },
    });
    return response;
  } catch (error) {
    if (error instanceof ExportLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("[privacy-export] Failed to build export", error);
    return NextResponse.json({ error: "Failed to build export" }, { status: 500 });
  }
}
