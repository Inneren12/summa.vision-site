import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROTATE_MB = 50;
const DEFAULT_ROTATE_DAYS = 7;

const TARGETS = [
  { name: "vitals", env: "METRICS_VITALS_FILE", defaultPath: "./.runtime/vitals.ndjson" },
  { name: "errors", env: "METRICS_ERRORS_FILE", defaultPath: "./.runtime/errors.ndjson" },
  { name: "telemetry", env: "TELEMETRY_FILE", defaultPath: "./.runtime/telemetry.ndjson" },
];

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

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function resolveChunkPath(basePath, date, attempt = 0) {
  const resolved = path.resolve(basePath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved);
  const ext = path.extname(base);
  const prefix = base.slice(0, base.length - ext.length);
  const datePart = formatDateUTC(date);
  const suffix = attempt > 0 ? `-${attempt}` : "";
  const name = `${prefix}-${datePart}${suffix}${ext}`;
  return path.join(dir, name);
}

export function shouldRotate(stats, now, { maxBytes, maxAgeMs }) {
  if (!stats) return false;
  if (stats.size === 0) return false;
  if (Number.isFinite(maxBytes) && maxBytes > 0 && stats.size >= maxBytes) {
    return true;
  }
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    const age = now - stats.mtimeMs;
    if (age >= maxAgeMs) {
      return true;
    }
  }
  return false;
}

async function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function uniqueChunkPath(basePath, date) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = resolveChunkPath(basePath, date, attempt);
    try {
      await fs.access(candidate);
      attempt += 1;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }
}

export async function rotateFile(basePath, options) {
  const filePath = path.resolve(basePath);
  let stats;
  try {
    stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return { rotated: false, reason: "not-a-file", file: filePath };
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { rotated: false, reason: "missing", file: filePath };
    }
    throw error;
  }

  const now = options.now ?? Date.now();
  if (!shouldRotate(stats, now, options)) {
    return { rotated: false, reason: "threshold", file: filePath };
  }

  const chunkPath = await uniqueChunkPath(filePath, new Date(now));
  await ensureDirectory(chunkPath);
  await fs.rename(filePath, chunkPath);
  await ensureDirectory(filePath);
  await fs.writeFile(filePath, "", { flag: "a" });
  if (stats.mode) {
    await fs.chmod(filePath, stats.mode);
  }
  return {
    rotated: true,
    file: filePath,
    chunk: chunkPath,
    bytes: stats.size,
    mtimeMs: stats.mtimeMs,
  };
}

export async function rotateTargets(targets, options) {
  const results = [];
  for (const target of targets) {
    const filePath = process.env[target.env] || target.defaultPath;
    const outcome = await rotateFile(filePath, options);
    results.push({ ...outcome, name: target.name });
  }
  return results;
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function parseOptionsFromEnv() {
  const maxMb = parseNumber(process.env.METRICS_ROTATE_MAX_MB, DEFAULT_ROTATE_MB);
  const rotateDays = parseNumber(process.env.METRICS_ROTATE_DAYS, DEFAULT_ROTATE_DAYS);
  return {
    maxBytes: maxMb > 0 ? maxMb * 1024 * 1024 : 0,
    maxAgeMs: rotateDays > 0 ? rotateDays * DAY_MS : 0,
    now: Date.now(),
  };
}

async function run() {
  const options = parseOptionsFromEnv();
  const results = await rotateTargets(TARGETS, options);
  for (const result of results) {
    if (!result.rotated) {
      if (result.reason !== "missing") {
        console.log(`[metrics-rotate] ${result.name}: skipped (${result.reason ?? "no-change"})`);
      }
      continue;
    }
    const bytes = formatBytes(result.bytes ?? 0);
    const date = new Date(result.mtimeMs ?? options.now);
    console.log(
      `[metrics-rotate] ${result.name}: rotated ${path.basename(result.file)} (${bytes}, ${date.toISOString()}) -> ${path.basename(result.chunk)}`,
    );
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (!entryUrl || import.meta.url === entryUrl) {
  run().catch((error) => {
    console.error("[metrics-rotate] Failed", error);
    process.exitCode = 1;
  });
}
