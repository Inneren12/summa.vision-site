import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROTATE_DAYS = 7;
const DEFAULT_RETENTION_DAYS = 14;

const TARGETS = [
  { name: "vitals", env: "METRICS_VITALS_FILE", defaultPath: "./.runtime/vitals.ndjson" },
  { name: "errors", env: "METRICS_ERRORS_FILE", defaultPath: "./.runtime/errors.ndjson" },
  { name: "telemetry", env: "TELEMETRY_FILE", defaultPath: "./.runtime/telemetry.ndjson" },
];

const DEFAULT_ERASURE_FILE = path.resolve(".runtime", "privacy.erasure.ndjson");

function parseNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseChunkDate(name, prefix, ext) {
  const pattern = new RegExp(
    `^${escapeRegExp(prefix)}-(\\d{8})(?:[-_](\\d+))?${escapeRegExp(ext)}$`,
  );
  const match = name.match(pattern);
  if (!match) return null;
  const datePart = match[1];
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function createMatcher(records) {
  const sid = new Set();
  const aid = new Set();
  const user = new Set();
  for (const record of records) {
    const sidValue = normalize(record.sid) ?? normalize(record.stableId);
    if (sidValue) {
      sid.add(sidValue);
    }
    const aidValue = normalize(record.aid);
    if (aidValue) {
      aid.add(aidValue);
    }
    const userValue = normalize(record.userId);
    if (userValue) {
      user.add(userValue);
      sid.add(`u:${userValue}`);
    }
  }
  return {
    hasAny() {
      return sid.size > 0 || aid.size > 0 || user.size > 0;
    },
    isErased(candidate) {
      if (!this.hasAny()) return false;
      const sidCandidate =
        normalize(candidate.sid) ?? normalize(candidate.sessionId) ?? normalize(candidate.stableId);
      if (sidCandidate && sid.has(sidCandidate)) {
        return true;
      }
      const aidCandidate = normalize(candidate.aid);
      if (aidCandidate && aid.has(aidCandidate)) {
        return true;
      }
      const userCandidate = normalize(candidate.userId);
      if (userCandidate && user.has(userCandidate)) {
        return true;
      }
      return false;
    },
  };
}

async function loadErasureMatcher() {
  const file = process.env.PRIVACY_ERASURE_FILE
    ? path.resolve(process.env.PRIVACY_ERASURE_FILE)
    : DEFAULT_ERASURE_FILE;
  try {
    const data = await fs.readFile(file, "utf8");
    const lines = data
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const records = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") {
          records.push(parsed);
        }
      } catch {
        // ignore invalid entries
      }
    }
    return createMatcher(records);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return createMatcher([]);
    }
    throw error;
  }
}

async function enumerateChunks(basePath) {
  const resolved = path.resolve(basePath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved);
  const ext = path.extname(base);
  const prefix = base.slice(0, base.length - ext.length);
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { basePath: resolved, dir, prefix, ext, chunks: [] };
    }
    throw error;
  }

  const chunks = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const date = parseChunkDate(entry.name, prefix, ext);
    if (!date) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) continue;
      chunks.push({
        path: filePath,
        name: entry.name,
        date,
        size: stats.size,
        mode: stats.mode,
      });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  chunks.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return { basePath: resolved, dir, prefix, ext, chunks };
}

async function removeExpiredChunks(chunks, cutoffMs) {
  if (!Number.isFinite(cutoffMs)) {
    return { kept: chunks, removed: [] };
  }
  const kept = [];
  const removed = [];
  for (const chunk of chunks) {
    if (chunk.date.getTime() < cutoffMs) {
      await fs.rm(chunk.path, { force: true });
      removed.push(chunk);
    } else {
      kept.push(chunk);
    }
  }
  return { kept, removed };
}

async function* readLines(filePath) {
  let stream;
  try {
    stream = createReadStream(filePath, { encoding: "utf8" });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
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
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }
    throw error;
  } finally {
    rl.close();
    stream.destroy();
  }
}

function shouldDropLine(line, matcher) {
  if (!matcher || !matcher.hasAny()) return false;
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = {
    sid: typeof parsed.sid === "string" ? parsed.sid : undefined,
    aid: typeof parsed.aid === "string" ? parsed.aid : undefined,
    userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
    stableId: typeof parsed.stableId === "string" ? parsed.stableId : undefined,
    sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
  };
  if (!candidate.sid && typeof parsed.stableId === "string") {
    candidate.sid = parsed.stableId;
  }
  if (!candidate.sid && typeof parsed.sessionId === "string") {
    candidate.sid = parsed.sessionId;
  }
  if (!candidate.aid && typeof parsed.ff_aid === "string") {
    candidate.aid = parsed.ff_aid;
  }
  return matcher.isErased(candidate);
}

async function rewriteGroup(dir, prefix, ext, dateKey, group, matcher) {
  const canonicalName = `${prefix}-${dateKey}${ext}`;
  const canonicalPath = path.join(dir, canonicalName);
  const sources = group.map((chunk) => chunk.path).sort((a, b) => a.localeCompare(b));

  const tmpName = `${prefix}-${dateKey}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  const tmpPath = path.join(dir, tmpName);
  await fs.mkdir(dir, { recursive: true });
  const handle = await fs.open(tmpPath, "w");
  let kept = 0;
  let removed = 0;
  try {
    for (const source of sources) {
      for await (const line of readLines(source)) {
        if (shouldDropLine(line, matcher)) {
          removed += 1;
          continue;
        }
        await handle.write(`${line}\n`);
        kept += 1;
      }
    }
  } finally {
    await handle.close();
  }

  await fs.rename(tmpPath, canonicalPath);
  const sourceWithStats = group.find((chunk) => chunk.mode);
  if (sourceWithStats && sourceWithStats.mode) {
    await fs.chmod(canonicalPath, sourceWithStats.mode);
  }
  for (const source of sources) {
    if (path.resolve(source) !== canonicalPath) {
      await fs.rm(source, { force: true });
    }
  }

  return { file: canonicalPath, kept, removed };
}

export async function compactTarget(basePath, options) {
  const { basePath: resolved, dir, prefix, ext, chunks } = await enumerateChunks(basePath);
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoffMs =
    retentionDays > 0 ? options.now - retentionDays * DAY_MS : Number.NEGATIVE_INFINITY;
  const { kept, removed } = await removeExpiredChunks(chunks, cutoffMs);

  const groups = new Map();
  for (const chunk of kept) {
    const key = formatDateUTC(chunk.date);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(chunk);
  }

  const forceRewrite = Boolean(options?.alwaysRewrite && options?.matcher?.hasAny?.());
  const summaries = [];
  for (const [dateKey, group] of groups.entries()) {
    const canonicalName = `${prefix}-${dateKey}${ext}`;
    const needsRewrite =
      forceRewrite ||
      group.length > 1 ||
      group.some((chunk) => path.basename(chunk.path) !== canonicalName);
    if (!needsRewrite) {
      continue;
    }
    const summary = await rewriteGroup(dir, prefix, ext, dateKey, group, options.matcher);
    summaries.push(summary);
  }

  return {
    target: resolved,
    removedCount: removed.length,
    rewritten: summaries,
  };
}

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const value = Number(arg.slice("--days=".length));
      if (Number.isFinite(value)) {
        result.days = value;
      }
    }
  }
  return result;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rotateDays = parseNumber(process.env.METRICS_ROTATE_DAYS, DEFAULT_ROTATE_DAYS);
  const retentionDays = args.days ?? Math.max(rotateDays, DEFAULT_RETENTION_DAYS);
  const matcher = await loadErasureMatcher();
  const options = { retentionDays, matcher, now: Date.now() };
  for (const target of TARGETS) {
    const filePath = process.env[target.env] || target.defaultPath;
    const result = await compactTarget(filePath, options);
    const removedMsg =
      result.removedCount > 0 ? `${result.removedCount} old chunk(s) removed` : "no old chunks";
    if (result.rewritten.length === 0) {
      console.log(`[metrics-compact] ${target.name}: ${removedMsg}, nothing to merge`);
      continue;
    }
    const mergeSummary = result.rewritten
      .map((entry) => `${path.basename(entry.file)}(+${entry.kept}/-${entry.removed})`)
      .join(", ");
    console.log(
      `[metrics-compact] ${target.name}: ${removedMsg}, merged ${result.rewritten.length} chunk(s): ${mergeSummary}`,
    );
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (!entryUrl || import.meta.url === entryUrl) {
  run().catch((error) => {
    console.error("[metrics-compact] Failed", error);
    process.exitCode = 1;
  });
}

export { loadErasureMatcher, parseArgs };
