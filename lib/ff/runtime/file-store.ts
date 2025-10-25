import fs from "node:fs/promises";
import path from "node:path";

import { MemoryFlagStore } from "./memory-store";
import type {
  FlagConfig,
  FlagEvaluationContext,
  FlagEvaluationResult,
  FlagSnapshot,
  FlagStore,
  OverrideEntry,
  OverrideScope,
} from "./types";

type PersistedShape = FlagSnapshot;

async function readSnapshot(file: string): Promise<PersistedShape | null> {
  try {
    const data = await fs.readFile(file, "utf8");
    if (!data) return { flags: [], overrides: [] } satisfies FlagSnapshot;
    const parsed = JSON.parse(data) as PersistedShape;
    if (!parsed.flags || !parsed.overrides) return { flags: [], overrides: [] };
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const DEFAULT_READ_TTL_MS = 5_000;

type FileFlagStoreOptions = {
  tmpDir?: string;
  readTtlMs?: number;
};

export class FileFlagStore implements FlagStore {
  private readonly memory = new MemoryFlagStore();
  private readonly file: string;
  private readonly tmpDir: string;
  private readonly readTtlMs: number;
  private lastLoaded = 0;
  private lastChecked = 0;
  private initializing: Promise<void>;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    file: string,
    tmpDirOrOptions?: string | FileFlagStoreOptions,
    options?: FileFlagStoreOptions,
  ) {
    this.file = path.resolve(file);

    let tmpDir = typeof tmpDirOrOptions === "string" ? tmpDirOrOptions : undefined;
    const resolvedOptions =
      typeof tmpDirOrOptions === "object" && tmpDirOrOptions !== null
        ? tmpDirOrOptions
        : (options ?? {});

    if (resolvedOptions.tmpDir) {
      tmpDir = resolvedOptions.tmpDir;
    }

    this.tmpDir = path.resolve(tmpDir ?? path.dirname(this.file));
    this.readTtlMs = Math.max(0, resolvedOptions.readTtlMs ?? DEFAULT_READ_TTL_MS);
    this.initializing = this.initialize();
  }

  private async initialize() {
    await ensureDirectory(path.dirname(this.file));
    await ensureDirectory(this.tmpDir);
    await this.performRefresh(true);
  }

  private async refreshFromDisk(force = false): Promise<void> {
    await this.initializing;
    if (!force && Date.now() - this.lastChecked < this.readTtlMs) {
      if (this.refreshPromise) {
        await this.refreshPromise;
      }
      return;
    }
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }
    this.refreshPromise = this.performRefresh(force).finally(() => {
      this.refreshPromise = null;
    });
    await this.refreshPromise;
  }

  private async performRefresh(force = false) {
    const now = Date.now();
    this.lastChecked = now;
    try {
      const stats = await fs.stat(this.file);
      if (!force && stats.mtimeMs <= this.lastLoaded) {
        return;
      }
      const snapshot = await readSnapshot(this.file);
      if (snapshot) {
        this.memory.replaceSnapshot(snapshot);
      } else {
        this.memory.replaceSnapshot({ flags: [], overrides: [] });
      }
      this.lastLoaded = stats.mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.memory.replaceSnapshot({ flags: [], overrides: [] });
        this.lastLoaded = now;
        return;
      }
      throw error;
    }
  }

  private async persist() {
    await this.initializing;
    const snapshot = await this.memory.snapshot();
    const payload = JSON.stringify(snapshot, null, 2);
    const tempName = `${path.basename(this.file)}.${process.pid}.${Date.now()}.tmp`;
    const tempPath = path.join(this.tmpDir, tempName);
    await fs.writeFile(tempPath, payload, "utf8");
    await fs.rename(tempPath, this.file);
    const now = Date.now();
    this.lastLoaded = now;
    this.lastChecked = now;
  }

  async listFlags(): Promise<FlagConfig[]> {
    await this.refreshFromDisk();
    return this.memory.listFlags();
  }

  async getFlag(key: string): Promise<FlagConfig | undefined> {
    await this.refreshFromDisk();
    return this.memory.getFlag(key);
  }

  async putFlag(config: FlagConfig): Promise<FlagConfig> {
    await this.refreshFromDisk();
    const updated = await this.memory.putFlag(config);
    await this.persist();
    return updated;
  }

  async removeFlag(key: string): Promise<void> {
    await this.refreshFromDisk();
    await this.memory.removeFlag(key);
    await this.persist();
  }

  async listOverrides(flag: string): Promise<OverrideEntry[]> {
    await this.refreshFromDisk();
    return this.memory.listOverrides(flag);
  }

  async putOverride(entry: OverrideEntry): Promise<OverrideEntry> {
    await this.refreshFromDisk();
    const updated = await this.memory.putOverride(entry);
    await this.persist();
    return updated;
  }

  async removeOverride(flag: string, scope: OverrideScope): Promise<void> {
    await this.refreshFromDisk();
    await this.memory.removeOverride(flag, scope);
    await this.persist();
  }

  async deleteOverridesByUser(userId: string): Promise<number> {
    await this.refreshFromDisk();
    const removed = await this.memory.deleteOverridesByUser(userId);
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  async evaluate(
    key: string,
    ctx: FlagEvaluationContext,
  ): Promise<FlagEvaluationResult | undefined> {
    await this.refreshFromDisk();
    return this.memory.evaluate(key, ctx);
  }

  async snapshot(): Promise<FlagSnapshot> {
    await this.refreshFromDisk();
    return this.memory.snapshot();
  }
}

export const DEFAULT_FILE_STORE_PATH = path.resolve(".runtime", "flags.snapshot.json");
export const DEFAULT_FILE_STORE_TMP = path.resolve(".runtime", "tmp");
