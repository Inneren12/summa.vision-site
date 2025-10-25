import crypto from "node:crypto";

import type { Redis } from "ioredis";

import { InMemoryRuntimeLock, type RuntimeLock } from "./lock";

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

type RedisLockOptions = {
  ttlMs?: number;
  retryDelayMs?: number;
  logPrefix?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RedisRuntimeLock implements RuntimeLock {
  private readonly redis: Redis;
  private readonly ttlMs: number;
  private readonly retryDelayMs: number;
  private readonly logPrefix: string;
  private fallback: InMemoryRuntimeLock | null = null;

  constructor(redis: Redis, options?: RedisLockOptions) {
    this.redis = redis;
    this.ttlMs = options?.ttlMs ?? 15_000;
    this.retryDelayMs = options?.retryDelayMs ?? 50;
    this.logPrefix = options?.logPrefix ?? "RedisRuntimeLock";
  }

  private async withRedisLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const token = crypto.randomUUID();
    const lockKey = `ff:lock:${key}`;
    const deadline = Date.now() + this.ttlMs;

    let acquired = false;
    while (!acquired) {
      const result = await this.redis.set(lockKey, token, "PX", this.ttlMs, "NX");
      if (result === "OK") {
        acquired = true;
        break;
      }
      if (Date.now() > deadline) {
        throw new Error(`Failed to acquire Redis lock for ${key} within ${this.ttlMs}ms`);
      }
      await sleep(this.retryDelayMs);
    }

    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined);
    }
  }

  async withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    if (this.fallback) {
      return this.fallback.withLock(key, fn);
    }
    try {
      return await this.withRedisLock(key, fn);
    } catch (error) {
      if (!this.fallback) {
        console.error(
          `[${this.logPrefix}] Falling back to in-memory lock due to Redis error`,
          error,
        );
        this.fallback = new InMemoryRuntimeLock();
      }
      return this.fallback.withLock(key, fn);
    }
  }
}
