import path from "node:path";

import Redis from "ioredis";

import { FileFlagStore, DEFAULT_FILE_STORE_PATH, DEFAULT_FILE_STORE_TMP } from "./file-store";
import { InMemoryRuntimeLock, FileRuntimeLock, type RuntimeLock } from "./lock";
import { MemoryFlagStore } from "./memory-store";
import { RedisRuntimeLock } from "./redis-lock";
import { RedisFlagStore } from "./redis-store";
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

function safeRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveRedisAdapter(url: string): StoreResolution {
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
  const ttlMs = Number(process.env.ROLLOUT_LOCK_TTL_MS ?? 15_000);
  const retryMs = Number(process.env.ROLLOUT_LOCK_RETRY_MS ?? 50);
  const store = new RedisFlagStore(client);
  const lock = new RedisRuntimeLock(client, {
    ttlMs,
    retryDelayMs: retryMs,
  });
  client.on("error", (error) => {
    console.error(`[RedisStore] connection error`, error);
  });
  client.on("connect", () => {
    console.info(`[RedisStore] active @ ${safeRedisUrl(url)}`);
  });
  return { store, lock } satisfies StoreResolution;
}

export function resolveStoreAdapter(): StoreResolution {
  const adapterEnv = process.env.FF_STORE_ADAPTER?.toLowerCase();
  const redisUrlEnv = process.env.REDIS_URL || process.env.FF_REDIS_URL;

  if (adapterEnv === "redis" || (!adapterEnv && redisUrlEnv)) {
    if (!redisUrlEnv) {
      console.warn(
        "[RedisStore] FF_STORE_ADAPTER=redis but REDIS_URL is not set. Falling back to memory store.",
      );
    } else {
      try {
        return resolveRedisAdapter(redisUrlEnv);
      } catch (error) {
        console.error(
          `[RedisStore] Failed to initialize Redis adapter (${safeRedisUrl(redisUrlEnv)}). Falling back to memory store.`,
          error,
        );
      }
    }
  }

  switch (adapterEnv) {
    case "file":
      return resolveFileAdapter();
    case "memory":
    case undefined:
      return {
        store: new MemoryFlagStore(),
        lock: new InMemoryRuntimeLock(),
      } satisfies StoreResolution;
    default:
      throw new Error(
        `Unknown FF_STORE_ADAPTER "${process.env.FF_STORE_ADAPTER}". Expected one of: memory, file, redis.`,
      );
  }
}
