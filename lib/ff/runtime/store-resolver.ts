import path from "node:path";

import { FileFlagStore, DEFAULT_FILE_STORE_PATH, DEFAULT_FILE_STORE_TMP } from "./file-store";
import { InMemoryRuntimeLock, FileRuntimeLock, type RuntimeLock } from "./lock";
import { MemoryFlagStore } from "./memory-store";
import type { FlagStore } from "./types";

type StoreResolution = {
  store: FlagStore;
  lock: RuntimeLock;
};

function resolveFileAdapter(): StoreResolution {
  const storeFile = process.env.FF_STORE_FILE
    ? path.resolve(process.env.FF_STORE_FILE)
    : DEFAULT_FILE_STORE_PATH;
  const tmpDir = process.env.FF_STORE_TMP
    ? path.resolve(process.env.FF_STORE_TMP)
    : DEFAULT_FILE_STORE_TMP;
  const lockDir = process.env.FF_STORE_LOCK_DIR
    ? path.resolve(process.env.FF_STORE_LOCK_DIR)
    : path.join(path.dirname(storeFile), "locks");
  const ttlMs = Number(process.env.FF_STORE_LOCK_TTL_MS ?? 30_000);
  const retryMs = Number(process.env.FF_STORE_LOCK_RETRY_MS ?? 50);
  const store = new FileFlagStore(storeFile, tmpDir);
  const lock = new FileRuntimeLock(lockDir, { ttlMs, retryDelayMs: retryMs });
  return { store, lock } satisfies StoreResolution;
}

export function resolveStoreAdapter(): StoreResolution {
  const adapter = (process.env.FF_STORE_ADAPTER || "memory").toLowerCase();
  switch (adapter) {
    case "memory":
      return {
        store: new MemoryFlagStore(),
        lock: new InMemoryRuntimeLock(),
      } satisfies StoreResolution;
    case "file":
      return resolveFileAdapter();
    case "redis":
    case "kv":
      throw new Error(
        `Adapter "${adapter}" is not available in this build. Configure FF_STORE_ADAPTER=memory or FF_STORE_ADAPTER=file.`,
      );
    default:
      throw new Error(
        `Unknown FF_STORE_ADAPTER "${process.env.FF_STORE_ADAPTER}". Expected one of: memory, file.`,
      );
  }
}
