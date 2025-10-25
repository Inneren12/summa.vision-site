import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type ErasureIdentifier = {
  sid?: string;
  aid?: string;
  userId?: string;
  stableId?: string;
};

export type ErasureRecord = ErasureIdentifier & {
  ts: number;
  source: "self" | "admin" | "ops" | "system";
  note?: string;
};

type Candidate = {
  sid?: string | null;
  aid?: string | null;
  userId?: string | null;
  stableId?: string | null;
  sessionId?: string | null;
};

type ErasureSets = {
  sid: Set<string>;
  aid: Set<string>;
  user: Set<string>;
};

type Matcher = {
  hasAny(): boolean;
  isErased(candidate: Candidate): boolean;
};

const DEFAULT_ERASURE_FILE = path.resolve(".runtime", "privacy.erasure.ndjson");
const PURGE_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50MB

let cache: { mtimeMs: number; matcher: Matcher } | null = null;

function getFilePath(): string {
  return process.env.PRIVACY_ERASURE_FILE
    ? path.resolve(process.env.PRIVACY_ERASURE_FILE)
    : DEFAULT_ERASURE_FILE;
}

function normalize(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildSets(records: Iterable<Partial<ErasureRecord>>): ErasureSets {
  const sid = new Set<string>();
  const aid = new Set<string>();
  const user = new Set<string>();
  for (const rec of records) {
    const sidValue = normalize(rec.sid) ?? normalize(rec.stableId);
    if (sidValue) {
      sid.add(sidValue);
    }
    const aidValue = normalize(rec.aid);
    if (aidValue) {
      aid.add(aidValue);
    }
    const userValue = normalize(rec.userId);
    if (userValue) {
      user.add(userValue);
      sid.add(`u:${userValue}`);
    }
  }
  return { sid, aid, user } satisfies ErasureSets;
}

function createMatcher(records: Iterable<Partial<ErasureRecord>>): Matcher {
  const sets = buildSets(records);
  return {
    hasAny() {
      return sets.sid.size > 0 || sets.aid.size > 0 || sets.user.size > 0;
    },
    isErased(candidate: Candidate) {
      if (!this.hasAny()) return false;
      const sidCandidate =
        normalize(candidate.sid) ?? normalize(candidate.sessionId) ?? normalize(candidate.stableId);
      if (sidCandidate && sets.sid.has(sidCandidate)) {
        return true;
      }
      const aidCandidate = normalize(candidate.aid);
      if (aidCandidate && sets.aid.has(aidCandidate)) {
        return true;
      }
      const userCandidate = normalize(candidate.userId);
      if (userCandidate && sets.user.has(userCandidate)) {
        return true;
      }
      return false;
    },
  } satisfies Matcher;
}

const EMPTY_MATCHER = createMatcher([]);

function parseRecord(line: string): ErasureRecord | null {
  try {
    const parsed = JSON.parse(line) as Partial<ErasureRecord>;
    const ts = typeof parsed.ts === "number" && Number.isFinite(parsed.ts) ? parsed.ts : Date.now();
    const source =
      parsed.source === "self" ||
      parsed.source === "admin" ||
      parsed.source === "ops" ||
      parsed.source === "system"
        ? parsed.source
        : "system";
    const record: ErasureRecord = {
      ts,
      source,
      sid: normalize(parsed.sid),
      aid: normalize(parsed.aid),
      userId: normalize(parsed.userId),
      stableId: normalize(parsed.stableId),
      note: typeof parsed.note === "string" ? parsed.note : undefined,
    };
    if (!record.sid && !record.aid && !record.userId && !record.stableId) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

async function readRecords(): Promise<ErasureRecord[]> {
  const file = getFilePath();
  try {
    const data = await fsp.readFile(file, "utf8");
    return data
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(parseRecord)
      .filter((record): record is ErasureRecord => record !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function readRecordsSync(): ErasureRecord[] {
  const file = getFilePath();
  try {
    const data = fs.readFileSync(file, "utf8");
    return data
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(parseRecord)
      .filter((record): record is ErasureRecord => record !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendErasure(
  record: ErasureIdentifier,
  source: ErasureRecord["source"],
  note?: string,
) {
  const payload: ErasureRecord = {
    ts: Date.now(),
    source,
    note,
    sid: normalize(record.sid),
    aid: normalize(record.aid),
    userId: normalize(record.userId),
    stableId: normalize(record.stableId),
  };
  if (!payload.sid && !payload.aid && !payload.userId && !payload.stableId) {
    throw new Error("At least one identifier is required for erasure");
  }
  const file = getFilePath();
  const dir = path.dirname(file);
  await fsp.mkdir(dir, { recursive: true });
  const line = `${JSON.stringify(payload)}\n`;
  await fsp.appendFile(file, line, "utf8");
  cache = null;
}

export async function loadErasureMatcher(): Promise<Matcher> {
  const file = getFilePath();
  try {
    const stats = await fsp.stat(file);
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache.matcher;
    }
    const records = await readRecords();
    const matcher = createMatcher(records);
    cache = { mtimeMs: stats.mtimeMs, matcher };
    return matcher;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cache = { mtimeMs: 0, matcher: EMPTY_MATCHER };
      return EMPTY_MATCHER;
    }
    throw error;
  }
}

export function loadErasureMatcherSync(): Matcher {
  const file = getFilePath();
  try {
    const stats = fs.statSync(file);
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache.matcher;
    }
    const records = readRecordsSync();
    const matcher = createMatcher(records);
    cache = { mtimeMs: stats.mtimeMs, matcher };
    return matcher;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cache = { mtimeMs: 0, matcher: EMPTY_MATCHER };
      return EMPTY_MATCHER;
    }
    throw error;
  }
}

export function isErasedSync(candidate: Candidate): boolean {
  return loadErasureMatcherSync().isErased(candidate);
}

export async function isErased(candidate: Candidate): Promise<boolean> {
  const matcher = await loadErasureMatcher();
  return matcher.isErased(candidate);
}

type PurgeCandidate = ErasureIdentifier;

export type PurgeFileReport = {
  file: string;
  removed: number;
  retained: number;
  sizeBytes: number;
  skipped: boolean;
};

function createMatcherForPurge(candidate: PurgeCandidate): Matcher {
  return createMatcher([
    {
      sid: candidate.sid,
      aid: candidate.aid,
      userId: candidate.userId,
      stableId: candidate.stableId,
    },
  ]);
}

function shouldPurgeLine(line: string, matcher: Matcher): boolean {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return false;
  }
  const candidate: Candidate = {
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
  if (!candidate.aid) {
    const aid = (parsed as Record<string, unknown>)["ff_aid"];
    if (typeof aid === "string") {
      candidate.aid = aid;
    }
  }
  return matcher.isErased(candidate);
}

export async function purgeNdjsonFiles(
  files: string[],
  candidate: PurgeCandidate,
): Promise<PurgeFileReport[]> {
  const matcher = createMatcherForPurge(candidate);
  if (!matcher.hasAny()) {
    return files.map((file) => ({
      file: path.resolve(file),
      removed: 0,
      retained: 0,
      sizeBytes: 0,
      skipped: true,
    }));
  }
  const reports: PurgeFileReport[] = [];
  for (const file of files) {
    const resolved = path.resolve(file);
    try {
      const stats = await fsp.stat(resolved);
      if (stats.size > PURGE_THRESHOLD_BYTES) {
        reports.push({
          file: resolved,
          removed: 0,
          retained: 0,
          sizeBytes: stats.size,
          skipped: true,
        });
        continue;
      }
      const content = await fsp.readFile(resolved, "utf8");
      const lines = content.split(/\r?\n/);
      const kept: string[] = [];
      let removed = 0;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (shouldPurgeLine(line, matcher)) {
          removed += 1;
          continue;
        }
        kept.push(line);
      }
      if (removed > 0) {
        const payload = kept.map((line) => `${line}\n`).join("");
        await fsp.writeFile(resolved, payload, "utf8");
        cache = null;
      }
      reports.push({
        file: resolved,
        removed,
        retained: kept.length,
        sizeBytes: stats.size,
        skipped: false,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reports.push({ file: resolved, removed: 0, retained: 0, sizeBytes: 0, skipped: false });
        continue;
      }
      throw error;
    }
  }
  return reports;
}

export function __clearErasureCacheForTests() {
  cache = null;
}
