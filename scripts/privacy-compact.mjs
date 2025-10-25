import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

import { compactTarget, loadErasureMatcher, parseArgs } from "./metrics-compact.mjs";

const DEFAULT_ROTATE_DAYS = 7;
const DEFAULT_RETENTION_DAYS = 14;

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

function normalize(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
  const hasAny = matcher?.hasAny?.();
  if (!hasAny) return false;
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = {
    sid: normalize(parsed.sid),
    aid: normalize(parsed.aid),
    userId: normalize(parsed.userId),
    stableId: normalize(parsed.stableId),
    sessionId: normalize(parsed.sessionId),
  };
  if (!candidate.sid && typeof parsed.stableId === "string") {
    candidate.sid = normalize(parsed.stableId);
  }
  if (!candidate.sid && typeof parsed.sessionId === "string") {
    candidate.sid = normalize(parsed.sessionId);
  }
  if (!candidate.aid && typeof parsed.ff_aid === "string") {
    candidate.aid = normalize(parsed.ff_aid);
  }
  return matcher.isErased(candidate);
}

export async function filterActiveFile(basePath, matcher) {
  const hasAny = matcher?.hasAny?.();
  if (!hasAny) {
    return { filtered: false, removed: 0, kept: 0 };
  }
  const resolved = path.resolve(basePath);
  let stats;
  try {
    stats = await fs.stat(resolved);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { filtered: false, removed: 0, kept: 0 };
    }
    throw error;
  }
  if (!stats.isFile()) {
    return { filtered: false, removed: 0, kept: 0 };
  }

  const tmpName = `${path.basename(resolved)}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  const tmpPath = path.join(path.dirname(resolved), tmpName);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const handle = await fs.open(tmpPath, "w");
  let removed = 0;
  let kept = 0;
  let changed = false;
  try {
    for await (const line of readLines(resolved)) {
      if (shouldDropLine(line, matcher)) {
        removed += 1;
        changed = true;
        continue;
      }
      await handle.write(`${line}\n`);
      kept += 1;
    }
  } finally {
    await handle.close();
  }

  if (!changed) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined);
    return { filtered: false, removed, kept };
  }

  await fs.rename(tmpPath, resolved);
  if (typeof stats.mode === "number") {
    await fs.chmod(resolved, stats.mode);
  }
  return { filtered: true, removed, kept };
}

export async function compactPrivacyTarget(basePath, options) {
  const summary = await compactTarget(basePath, {
    ...options,
    alwaysRewrite: true,
  });
  const active = await filterActiveFile(basePath, options.matcher);
  return { summary, active };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rotateDays = parseNumber(process.env.METRICS_ROTATE_DAYS, DEFAULT_ROTATE_DAYS);
  const retentionDays = args.days ?? Math.max(rotateDays, DEFAULT_RETENTION_DAYS);
  const matcher = await loadErasureMatcher();
  const now = Date.now();

  for (const target of TARGETS) {
    const filePath = process.env[target.env] || target.defaultPath;
    const { summary, active } = await compactPrivacyTarget(filePath, {
      retentionDays,
      matcher,
      now,
    });
    const removedMsg =
      summary.removedCount > 0 ? `${summary.removedCount} old chunk(s) removed` : "no old chunks";
    const mergeMsg =
      summary.rewritten.length > 0 ? `merged ${summary.rewritten.length} chunk(s)` : "no merges";
    const activeMsg = active.filtered
      ? `purged active file (-${active.removed}/+${active.kept})`
      : "active file unchanged";
    console.log(`[privacy-compact] ${target.name}: ${removedMsg}, ${mergeMsg}, ${activeMsg}`);
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (!entryUrl || import.meta.url === entryUrl) {
  run().catch((error) => {
    console.error("[privacy-compact] Failed", error);
    process.exitCode = 1;
  });
}
