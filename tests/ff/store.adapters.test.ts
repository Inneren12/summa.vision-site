import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FF, composeFFRuntime, resetFFRuntime } from "@/lib/ff/runtime";
import { FileFlagStore } from "@/lib/ff/runtime/file-store";
import { FileRuntimeLock, InMemoryRuntimeLock } from "@/lib/ff/runtime/lock";
import {
  createInitialConfig,
  createOverride,
  MemoryFlagStore,
} from "@/lib/ff/runtime/memory-store";
import {
  readSnapshotFromFile,
  restoreSnapshot,
  writeSnapshotToFile,
} from "@/lib/ff/runtime/snapshot";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ff-store-"));
}

describe("file store adapter", () => {
  const originalEnv = { ...process.env };
  const mutableEnv = process.env as Record<string, string | undefined>;
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    Object.keys(process.env).forEach((key) => delete mutableEnv[key]);
    Object.assign(process.env, originalEnv);
    resetFFRuntime();
  });

  afterEach(() => {
    resetFFRuntime();
    Object.keys(process.env).forEach((key) => delete mutableEnv[key]);
    Object.assign(process.env, originalEnv);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("persists flags to disk and reloads", () => {
    const storePath = path.join(tempDir, "flags.json");
    const store = new FileFlagStore(storePath, tempDir);
    const created = store.putFlag({ ...createInitialConfig("beta"), defaultValue: true });
    expect(created.key).toBe("beta");
    const override = createOverride("beta", { type: "global" }, false, "tester");
    store.putOverride(override);

    const nextStore = new FileFlagStore(storePath, tempDir);
    const reloaded = nextStore.getFlag("beta");
    expect(reloaded?.defaultValue).toBe(true);
    const overrides = nextStore.listOverrides("beta");
    expect(overrides).toHaveLength(1);
    expect(overrides[0].author).toBe("tester");
  });

  it("serializes concurrent rollout steps with file lock", async () => {
    const storePath = path.join(tempDir, "flags.json");
    const lockDir = path.join(tempDir, "locks");
    const store = new FileFlagStore(storePath, tempDir);
    const lock = new FileRuntimeLock(lockDir, { ttlMs: 5_000, retryDelayMs: 5 });
    store.putFlag({ ...createInitialConfig("exp"), rollout: { percent: 0 } });

    let concurrent = 0;
    let maxConcurrent = 0;

    const step = () =>
      lock.withLock("exp", async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        const flag = store.getFlag("exp");
        if (!flag) throw new Error("flag missing");
        await new Promise((resolve) => setTimeout(resolve, 20));
        const base = flag.rollout?.percent ?? 0;
        store.putFlag({
          ...flag,
          rollout: { ...(flag.rollout ?? { percent: 0 }), percent: Math.min(100, base + 10) },
        });
        concurrent -= 1;
      });

    await Promise.all([step(), step(), step()]);

    const result = store.getFlag("exp");
    expect(result?.rollout?.percent).toBe(30);
    expect(maxConcurrent).toBe(1);
  });

  it("restores snapshot into a fresh store", () => {
    const memory = new MemoryFlagStore();
    memory.putFlag({ ...createInitialConfig("gamma"), defaultValue: "A" });
    memory.putOverride(createOverride("gamma", { type: "global" }, "B", "tester"));
    const snapshot = memory.snapshot();
    const file = path.join(tempDir, "snapshot.json");
    writeSnapshotToFile(snapshot, file);

    const fresh = new MemoryFlagStore();
    const parsed = readSnapshotFromFile(file);
    restoreSnapshot(fresh, parsed);

    const flag = fresh.getFlag("gamma");
    expect(flag?.defaultValue).toBe("A");
    const overrides = fresh.listOverrides("gamma");
    expect(overrides).toHaveLength(1);
    expect(overrides[0].value).toBe("B");
  });

  it("configures file adapter via runtime env", () => {
    const storePath = path.join(tempDir, "runtime.json");
    mutableEnv.FF_STORE_ADAPTER = "file";
    mutableEnv.FF_STORE_FILE = storePath;
    mutableEnv.FF_STORE_TMP = tempDir;
    mutableEnv.FF_STORE_LOCK_DIR = path.join(tempDir, "locks");
    resetFFRuntime();
    const { store, lock } = FF();
    expect(store.snapshot().flags).toHaveLength(0);
    expect(lock).toBeInstanceOf(FileRuntimeLock);

    store.putFlag({ ...createInitialConfig("delta"), defaultValue: false });
    expect(fs.existsSync(storePath)).toBe(true);
  });

  it("falls back to memory when composing custom runtime", () => {
    const store = new MemoryFlagStore();
    const lock = new InMemoryRuntimeLock();
    composeFFRuntime({ store, lock });
    const runtime = FF();
    expect(runtime.store).toBe(store);
    expect(runtime.lock).toBe(lock);
  });
});
