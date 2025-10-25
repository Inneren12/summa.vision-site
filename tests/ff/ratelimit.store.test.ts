import type { Redis } from "ioredis";
import RedisMock from "ioredis-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enforceAdminRateLimit } from "@/lib/admin/rate-limit";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  __resetRateLimit,
  __setRateLimitStore,
} from "@/lib/ff/ratelimit";

describe("RateLimitStore", () => {
  afterEach(async () => {
    vi.useRealTimers();
    __setRateLimitStore(null);
    await __resetRateLimit();
  });

  it("denies after limit and resets after ttl (memory)", async () => {
    vi.useFakeTimers();
    const store = new MemoryRateLimitStore();
    expect((await store.allow("demo", 2, 1000)).ok).toBe(true);
    expect((await store.allow("demo", 2, 1000)).ok).toBe(true);
    const denied = await store.allow("demo", 2, 1000);
    expect(denied.ok).toBe(false);
    vi.advanceTimersByTime(1000);
    const allowed = await store.allow("demo", 2, 1000);
    expect(allowed.ok).toBe(true);
  });

  it("denies after limit when backed by redis", async () => {
    const redis = new RedisMock();
    const store = new RedisRateLimitStore(redis as unknown as Redis);
    expect((await store.allow("redis", 1, 5000)).ok).toBe(true);
    const denied = await store.allow("redis", 1, 5000);
    expect(denied.ok).toBe(false);
    await redis.flushall();
    redis.disconnect();
  });
});

describe("enforceAdminRateLimit", () => {
  beforeEach(async () => {
    const store = new MemoryRateLimitStore();
    __setRateLimitStore(store);
    await __resetRateLimit();
  });

  afterEach(async () => {
    __setRateLimitStore(null);
    await __resetRateLimit();
  });

  it("returns 429 after actor exceeds rpm", async () => {
    const req = new Request("http://localhost/api/admin/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const actor = { role: "admin" as const, session: "admin:abc" };
    const first = await enforceAdminRateLimit({ req, scope: "kill", rpm: 1, actor });
    expect(first.ok).toBe(true);
    const second = await enforceAdminRateLimit({ req, scope: "kill", rpm: 1, actor });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.response.status).toBe(429);
      expect(second.response.headers.get("Retry-After")).toBeTruthy();
    }
  });
});
