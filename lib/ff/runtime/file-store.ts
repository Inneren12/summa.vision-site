import fs from "node:fs";
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

function readSnapshot(file: string): PersistedShape | null {
  try {
    const data = fs.readFileSync(file, "utf8");
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

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class FileFlagStore implements FlagStore {
  private readonly memory = new MemoryFlagStore();
  private readonly file: string;
  private readonly tmpDir: string;
  private lastLoaded = 0;

  constructor(file: string, tmpDir?: string) {
    this.file = path.resolve(file);
    this.tmpDir = path.resolve(tmpDir ?? path.dirname(this.file));
    ensureDirectory(path.dirname(this.file));
    ensureDirectory(this.tmpDir);
    this.refreshFromDisk();
  }

  private refreshFromDisk() {
    try {
      const stats = fs.statSync(this.file);
      if (stats.mtimeMs <= this.lastLoaded) return;
      const snapshot = readSnapshot(this.file);
      if (snapshot) {
        this.memory.replaceSnapshot(snapshot);
      } else {
        this.memory.replaceSnapshot({ flags: [], overrides: [] });
      }
      this.lastLoaded = stats.mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.memory.replaceSnapshot({ flags: [], overrides: [] });
        this.lastLoaded = Date.now();
        return;
      }
      throw error;
    }
  }

  private persist() {
    const snapshot = this.memory.snapshot();
    const payload = JSON.stringify(snapshot, null, 2);
    const tempName = `${path.basename(this.file)}.${process.pid}.${Date.now()}.tmp`;
    const tempPath = path.join(this.tmpDir, tempName);
    fs.writeFileSync(tempPath, payload, "utf8");
    fs.renameSync(tempPath, this.file);
    this.lastLoaded = Date.now();
  }

  listFlags(): FlagConfig[] {
    this.refreshFromDisk();
    return this.memory.listFlags();
  }

  getFlag(key: string): FlagConfig | undefined {
    this.refreshFromDisk();
    return this.memory.getFlag(key);
  }

  putFlag(config: FlagConfig): FlagConfig {
    this.refreshFromDisk();
    const updated = this.memory.putFlag(config);
    this.persist();
    return updated;
  }

  removeFlag(key: string): void {
    this.refreshFromDisk();
    this.memory.removeFlag(key);
    this.persist();
  }

  listOverrides(flag: string): OverrideEntry[] {
    this.refreshFromDisk();
    return this.memory.listOverrides(flag);
  }

  putOverride(entry: OverrideEntry): OverrideEntry {
    this.refreshFromDisk();
    const updated = this.memory.putOverride(entry);
    this.persist();
    return updated;
  }

  removeOverride(flag: string, scope: OverrideScope): void {
    this.refreshFromDisk();
    this.memory.removeOverride(flag, scope);
    this.persist();
  }

  evaluate(key: string, ctx: FlagEvaluationContext): FlagEvaluationResult | undefined {
    this.refreshFromDisk();
    return this.memory.evaluate(key, ctx);
  }

  snapshot(): FlagSnapshot {
    this.refreshFromDisk();
    return this.memory.snapshot();
  }
}

export const DEFAULT_FILE_STORE_PATH = path.resolve(".runtime", "flags.snapshot.json");
export const DEFAULT_FILE_STORE_TMP = path.resolve(".runtime", "tmp");
