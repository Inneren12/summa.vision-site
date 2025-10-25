import type { Redis } from "ioredis";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetIn: number;
};

export interface RateLimitStore {
  allow(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

const DEFAULT_WINDOW_MS = 60_000;

class MemoryRateLimitStore implements RateLimitStore {
  private readonly bucket = new Map<string, { count: number; resetAt: number }>();

  async allow(
    key: string,
    limit: number,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.bucket.get(key);
    if (!current || current.resetAt <= now) {
      this.bucket.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: Math.max(0, limit - 1), resetIn: windowMs };
    }
    if (current.count >= limit) {
      return { ok: false, remaining: 0, resetIn: Math.max(0, current.resetAt - now) };
    }
    current.count += 1;
    return {
      ok: true,
      remaining: Math.max(0, limit - current.count),
      resetIn: Math.max(0, current.resetAt - now),
    };
  }

  reset() {
    this.bucket.clear();
  }
}

const REDIS_ALLOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  return {current, ARGV[1]}
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(redis: Redis, prefix = "ratelimit") {
    this.redis = redis;
    this.prefix = prefix;
  }

  private key(name: string): string {
    return this.prefix ? `${this.prefix}:${name}` : name;
  }

  async allow(
    key: string,
    limit: number,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): Promise<RateLimitResult> {
    const namespaced = this.key(key);
    const raw = (await this.redis.eval(REDIS_ALLOW_SCRIPT, 1, namespaced, String(windowMs))) as
      | [number | string, number | string]
      | null;
    const countRaw = raw?.[0] ?? 0;
    const ttlRaw = raw?.[1] ?? windowMs;
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    const ttl = typeof ttlRaw === "number" ? ttlRaw : Number(ttlRaw);
    if (!Number.isFinite(count)) {
      return { ok: true, remaining: Math.max(0, limit - 1), resetIn: windowMs };
    }
    if (count > limit) {
      return { ok: false, remaining: 0, resetIn: Math.max(0, ttl) };
    }
    return { ok: true, remaining: Math.max(0, limit - count), resetIn: Math.max(0, ttl) };
  }
}

let overrideStore: RateLimitStore | null = null;
let storePromise: Promise<RateLimitStore> | null = null;

function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function createRedisStore(url: string, prefix: string): Promise<RateLimitStore | null> {
  let client: Redis | null = null;
  try {
    const { default: RedisCtor } = await import("ioredis");
    client = new RedisCtor(url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    }) as unknown as Redis;
    client.on("error", (error) => {
      console.error(`[RateLimit] Redis error`, error);
    });
    await client.connect();
    console.info(`[RateLimit] Redis backend active @ ${safeUrl(url)}`);
    return new RedisRateLimitStore(client, prefix);
  } catch (error) {
    if (client) {
      try {
        client.disconnect();
      } catch {
        // ignore
      }
    }
    console.error(`[RateLimit] Failed to initialize Redis backend (${safeUrl(url)}).`, error);
    return null;
  }
}

async function resolveStore(): Promise<RateLimitStore> {
  if (overrideStore) return overrideStore;
  if (!storePromise) {
    storePromise = (async () => {
      const adapterEnv = process.env.ADMIN_RATE_LIMIT_ADAPTER?.toLowerCase();
      const prefix = process.env.ADMIN_RATE_LIMIT_REDIS_PREFIX ?? "ratelimit";
      const redisUrl =
        process.env.ADMIN_RATE_LIMIT_REDIS_URL ||
        process.env.RATE_LIMIT_REDIS_URL ||
        process.env.REDIS_URL ||
        process.env.FF_REDIS_URL;
      if (adapterEnv === "redis" || (!adapterEnv && redisUrl)) {
        if (!redisUrl) {
          console.warn(
            "[RateLimit] ADMIN_RATE_LIMIT_ADAPTER=redis but no redis URL configured. Falling back to memory store.",
          );
        } else {
          const redisStore = await createRedisStore(redisUrl, prefix);
          if (redisStore) {
            return redisStore;
          }
        }
      }
      console.info("[RateLimit] Using in-memory backend");
      return new MemoryRateLimitStore();
    })();
  }
  const store = await storePromise;
  return store;
}

export async function allow(
  key: string,
  limit = 10,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
  const store = await resolveStore();
  return store.allow(key, limit, windowMs);
}

export async function __resetRateLimit(): Promise<void> {
  if (overrideStore && overrideStore instanceof MemoryRateLimitStore) {
    overrideStore.reset();
    return;
  }
  if (storePromise) {
    const store = await storePromise;
    if (store instanceof MemoryRateLimitStore) {
      store.reset();
    }
  }
}

export function __setRateLimitStore(store: RateLimitStore | null) {
  overrideStore = store;
  if (!store) {
    storePromise = null;
  }
}

export { MemoryRateLimitStore, RedisRateLimitStore };
