import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;

type ChunkInfo = {
  file: string;
  date: Date | null;
  name: string;
};

type CollectOptions = {
  maxChunkDays?: number;
  maxChunkCount?: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseChunkDate(name: string, prefix: string, ext: string): Date | null {
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

async function readDirectory(dir: string): Promise<Dirent[]> {
  let dirEntries: Dirent[];
  try {
    dirEntries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return dirEntries;
}

export async function listNdjsonFiles(
  basePath: string | undefined,
  options?: CollectOptions,
): Promise<string[]> {
  if (!basePath) {
    return [];
  }

  const resolved = path.resolve(basePath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved);
  const ext = path.extname(base);
  const prefix = base.slice(0, base.length - ext.length);

  const maxChunkDays = options?.maxChunkDays ?? 14;
  const maxChunkCount = options?.maxChunkCount ?? 12;
  const includeLimit = maxChunkCount > 0 ? maxChunkCount : Infinity;
  const cutoffDate = maxChunkDays > 0 ? new Date(Date.now() - maxChunkDays * DAY_MS) : null;

  const entries = await readDirectory(dir);
  const chunks: ChunkInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    const stats = await fs
      .stat(filePath)
      .then((s) => s)
      .catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
    if (!stats || !stats.isFile()) continue;
    const date = parseChunkDate(entry.name, prefix, ext);
    if (!date) continue;
    if (cutoffDate && date < cutoffDate) continue;
    chunks.push({ file: filePath, name: entry.name, date });
  }

  chunks.sort((a, b) => {
    if (a.date && b.date) {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });

  const selected = chunks.slice(Math.max(0, chunks.length - includeLimit));
  return [...selected.map((chunk) => chunk.file), resolved];
}
