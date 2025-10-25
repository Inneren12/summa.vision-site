import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { FileFlagStore } from "@/lib/ff/runtime/file-store";
import { FileRuntimeLock } from "@/lib/ff/runtime/lock";
import { createInitialConfig } from "@/lib/ff/runtime/memory-store";

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ff-store-unit-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("FileFlagStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not refresh from disk more often than the read TTL", async () => {
    await withTempDir(async (dir) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
      const storePath = path.join(dir, "flags.json");
      const store = new FileFlagStore(storePath, { tmpDir: dir, readTtlMs: 5_000 });
      await store.listFlags();

      const statSpy = vi.spyOn(fs, "stat");
      await store.listFlags();
      await store.getFlag("missing");
      expect(statSpy).not.toHaveBeenCalled();

      vi.setSystemTime(new Date("2024-01-01T00:00:06Z"));
      await store.listFlags();
      expect(statSpy).toHaveBeenCalledTimes(1);
      statSpy.mockRestore();
    });
  });

  it("persists snapshots via an atomic rename", async () => {
    await withTempDir(async (dir) => {
      const storePath = path.join(dir, "flags.json");
      const store = new FileFlagStore(storePath, { tmpDir: dir, readTtlMs: 5_000 });
      const renameSpy = vi.spyOn(fs, "rename");

      await store.putFlag(createInitialConfig("alpha"));

      expect(renameSpy).toHaveBeenCalled();
      const [from, to] = renameSpy.mock.calls.at(-1)!;
      expect(to).toBe(storePath);
      expect(path.dirname(from)).toBe(dir);
      renameSpy.mockRestore();
    });
  });
});

describe("FileRuntimeLock", () => {
  it("allows acquisition once the stored expiry has passed", async () => {
    await withTempDir(async (dir) => {
      const lock = new FileRuntimeLock(dir, { ttlMs: 500, retryDelayMs: 10 });
      const key = "resource";
      const lockFile = path.join(
        dir,
        `${crypto.createHash("sha1").update(key).digest("hex")}.lock`,
      );
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        lockFile,
        JSON.stringify({ token: "stale", expiresAt: Date.now() - 1_000 }),
        "utf8",
      );

      const result = await lock.withLock(key, async () => "ok");
      expect(result).toBe("ok");
      await expect(fs.access(lockFile)).rejects.toThrow();
    });
  });

  it("fails to acquire when an unexpired lock exists", async () => {
    await withTempDir(async (dir) => {
      const key = "resource";
      const lockFile = path.join(
        dir,
        `${crypto.createHash("sha1").update(key).digest("hex")}.lock`,
      );
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        lockFile,
        JSON.stringify({ token: "active", expiresAt: Date.now() + 5_000 }),
        "utf8",
      );

      const lock = new FileRuntimeLock(dir, { ttlMs: 100, retryDelayMs: 10 });
      await expect(lock.withLock(key, async () => "ok")).rejects.toThrow(/Failed to acquire lock/);
    });
  });
});
