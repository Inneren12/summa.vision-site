import crypto from "node:crypto";

import type { Redis } from "ioredis";

import { pctHit, seedFor } from "../bucketing";

import { MemoryFlagStore } from "./memory-store";
import {
  type FlagConfig,
  type FlagEvaluationContext,
  type FlagEvaluationResult,
  type FlagSnapshot,
  type FlagStore,
  type OverrideEntry,
  type OverrideScope,
  type OverrideValue,
  type RolloutStrategy,
  type SeedBy,
  type SegmentConfig,
} from "./types";

const FLAG_KEY_PREFIX = "ff:flag:";
const OVERRIDE_KEY_PREFIX = "ff:override:";
const SCAN_COUNT = Number(process.env.FF_REDIS_SCAN_COUNT ?? 200);

function stableSalt(): string {
  return crypto.randomBytes(8).toString("hex");
}

function ensurePercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

function cloneConfig(config: FlagConfig): FlagConfig {
  return JSON.parse(JSON.stringify(config)) as FlagConfig;
}

function cloneOverride(entry: OverrideEntry): OverrideEntry {
  return JSON.parse(JSON.stringify(entry)) as OverrideEntry;
}

function isExpired(entry: OverrideEntry, now = Date.now()): boolean {
  if (!entry.expiresAt) return false;
  return entry.expiresAt <= now;
}

function matchesSegment(segment: SegmentConfig, ctx: FlagEvaluationContext): boolean {
  if (!segment.conditions || segment.conditions.length === 0) return true;
  return segment.conditions.every((condition) => {
    switch (condition.field) {
      case "user":
        return ctx.userId === condition.value;
      case "namespace":
        return ctx.namespace === condition.value;
      case "cookie":
        return ctx.cookieId === condition.value;
      case "ip":
        return ctx.ip === condition.value;
      case "ua":
        return ctx.userAgent === condition.value;
      case "tag":
        return ctx.tags?.includes(condition.value) ?? false;
      default:
        return false;
    }
  });
}

function flagKey(key: string): string {
  return `${FLAG_KEY_PREFIX}${key}`;
}

function overrideKey(flag: string): string {
  return `${OVERRIDE_KEY_PREFIX}${flag}`;
}

function normalizeFlag(config: FlagConfig, existing?: FlagConfig): FlagConfig {
  const now = Date.now();
  const segments = (config.segments ?? [])
    .map((segment) => ({ ...segment, id: segment.id || stableSalt() }))
    .sort((a, b) => a.priority - b.priority);
  return {
    ...config,
    createdAt: existing?.createdAt ?? config.createdAt ?? now,
    updatedAt: Number.isFinite(config.updatedAt) ? config.updatedAt! : now,
    segments,
  } satisfies FlagConfig;
}

type StoredOverride = OverrideEntry & { flag: string };

function scopeField(scope: OverrideScope): string {
  if (scope.type === "global") return "global";
  if (scope.type === "user") return `user:${scope.id}`;
  return `namespace:${scope.id}`;
}

function normalizeOverride(entry: OverrideEntry): StoredOverride {
  const now = Date.now();
  const expiresAt =
    entry.expiresAt ?? (entry.ttlSeconds ? now + entry.ttlSeconds * 1000 : undefined);
  return {
    ...entry,
    expiresAt,
    updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt! : now,
  } satisfies StoredOverride;
}

export class RedisFlagStore implements FlagStore {
  private readonly redis: Redis;
  private readonly scanCount: number;
  private readonly logPrefix: string;
  private readonly memoryFallback = new MemoryFlagStore();
  private fallbackActive = false;

  constructor(redis: Redis, scanCount = SCAN_COUNT, logPrefix = "RedisFlagStore") {
    this.redis = redis;
    this.scanCount = scanCount;
    this.logPrefix = logPrefix;
  }

  private async handle<T>(operation: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.fallbackActive) {
      return fallback();
    }
    try {
      return await operation();
    } catch (error) {
      if (!this.fallbackActive) {
        this.fallbackActive = true;
        console.error(
          `[${this.logPrefix}] Falling back to in-memory store due to Redis error`,
          error,
        );
      }
      return fallback();
    }
  }

  private async fetchFlag(key: string): Promise<FlagConfig | undefined> {
    const value = await this.redis.get(flagKey(key));
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as FlagConfig;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async fetchOverrides(flag: string): Promise<StoredOverride[]> {
    const raw = await this.redis.hgetall(overrideKey(flag));
    const entries: StoredOverride[] = [];
    const now = Date.now();
    for (const value of Object.values(raw)) {
      try {
        const parsed = JSON.parse(value) as StoredOverride;
        if (!isExpired(parsed, now)) {
          entries.push(parsed);
        }
      } catch {
        // ignore malformed entries
      }
    }
    if (entries.length !== Object.keys(raw).length) {
      await this.pruneExpired(flag, entries);
    }
    return entries;
  }

  private async pruneExpired(flag: string, entries: StoredOverride[]) {
    const key = overrideKey(flag);
    const pipeline = this.redis.pipeline();
    const remaining = new Set(entries.map((entry) => scopeField(entry.scope)));
    const raw = await this.redis.hkeys(key);
    let hasCommands = false;
    for (const field of raw) {
      if (!remaining.has(field)) {
        pipeline.hdel(key, field);
        hasCommands = true;
      }
    }
    if (hasCommands) {
      await pipeline.exec().catch(() => undefined);
    }
  }

  private async scanKeys(prefix: string): Promise<string[]> {
    const pattern = `${prefix}*`;
    let cursor = "0";
    const keys: string[] = [];
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        this.scanCount,
      );
      cursor = next;
      if (batch.length > 0) keys.push(...batch);
    } while (cursor !== "0");
    return keys;
  }

  async listFlags(): Promise<FlagConfig[]> {
    return this.handle(
      async () => {
        const keys = await this.scanKeys(FLAG_KEY_PREFIX);
        if (keys.length === 0) return [];
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          pipeline.get(key);
        }
        const results = await pipeline.exec();
        const flags: FlagConfig[] = [];
        for (const [, value] of results) {
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value) as FlagConfig;
              flags.push(parsed);
            } catch {
              // ignore malformed values
            }
          }
        }
        return flags;
      },
      () => this.memoryFallback.listFlags(),
    );
  }

  async getFlag(key: string): Promise<FlagConfig | undefined> {
    return this.handle(
      async () => {
        const flag = await this.fetchFlag(key);
        return flag ? cloneConfig(flag) : undefined;
      },
      () => this.memoryFallback.getFlag(key),
    );
  }

  async putFlag(config: FlagConfig): Promise<FlagConfig> {
    return this.handle(
      async () => {
        const existing = await this.fetchFlag(config.key);
        const normalized = normalizeFlag(config, existing);
        await this.redis.set(flagKey(config.key), JSON.stringify(normalized));
        await this.memoryFallback.putFlag(normalized);
        return cloneConfig(normalized);
      },
      async () => this.memoryFallback.putFlag(config),
    );
  }

  async removeFlag(key: string): Promise<void> {
    return this.handle(
      async () => {
        await this.redis.del(flagKey(key));
        await this.redis.del(overrideKey(key));
        await this.memoryFallback.removeFlag(key);
      },
      () => this.memoryFallback.removeFlag(key),
    );
  }

  async listOverrides(flag: string): Promise<OverrideEntry[]> {
    return this.handle(
      async () => {
        const entries = await this.fetchOverrides(flag);
        return entries.map(cloneOverride);
      },
      () => this.memoryFallback.listOverrides(flag),
    );
  }

  async putOverride(entry: OverrideEntry): Promise<OverrideEntry> {
    return this.handle(
      async () => {
        const normalized = normalizeOverride(entry);
        if (normalized.expiresAt && normalized.expiresAt <= Date.now()) {
          await this.removeOverride(entry.flag, entry.scope);
          return cloneOverride(normalized);
        }
        await this.redis.hset(
          overrideKey(entry.flag),
          scopeField(entry.scope),
          JSON.stringify(normalized),
        );
        await this.memoryFallback.putOverride(normalized);
        return cloneOverride(normalized);
      },
      () => this.memoryFallback.putOverride(entry),
    );
  }

  async removeOverride(flag: string, scope: OverrideScope): Promise<void> {
    return this.handle(
      async () => {
        await this.redis.hdel(overrideKey(flag), scopeField(scope));
        await this.memoryFallback.removeOverride(flag, scope);
      },
      () => this.memoryFallback.removeOverride(flag, scope),
    );
  }

  async deleteOverridesByUser(userId: string): Promise<number> {
    return this.handle(
      async () => {
        const keys = await this.scanKeys(OVERRIDE_KEY_PREFIX);
        if (keys.length === 0) {
          return 0;
        }
        const field = scopeField({ type: "user", id: userId });
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          pipeline.hdel(key, field);
        }
        const results = await pipeline.exec();
        let removed = 0;
        for (const [error, value] of results) {
          if (!error && typeof value === "number") {
            removed += value;
          }
        }
        if (removed > 0) {
          await this.memoryFallback.deleteOverridesByUser(userId);
        }
        return removed;
      },
      () => this.memoryFallback.deleteOverridesByUser(userId),
    );
  }

  async evaluate(
    key: string,
    ctx: FlagEvaluationContext,
  ): Promise<FlagEvaluationResult | undefined> {
    return this.handle(
      async () => {
        const [flag, overrides] = await Promise.all([
          this.fetchFlag(key),
          this.fetchOverrides(key),
        ]);
        if (!flag || !flag.enabled) return undefined;

        const killActive = (flag.killSwitch ?? flag.kill ?? false) === true;
        const globalKill = process.env.FF_KILL_ALL === "true";
        if (killActive || globalKill) {
          if (typeof flag.defaultValue === "boolean") {
            return {
              value: false,
              reason: "killSwitch",
            } satisfies FlagEvaluationResult;
          }
          const killValue = flag.killValue !== undefined ? flag.killValue : undefined;
          return {
            value: killValue,
            reason: "killSwitch",
          } satisfies FlagEvaluationResult;
        }

        const map = new Map<string, StoredOverride>();
        for (const entry of overrides) {
          map.set(scopeField(entry.scope), entry);
        }

        const seedByDefault = flag.seedByDefault ?? "stableId";
        if (ctx.userId) {
          const userOverride = map.get(scopeField({ type: "user", id: ctx.userId }));
          if (userOverride) {
            return {
              value: userOverride.value,
              reason: "user-override",
              override: cloneOverride(userOverride),
            } satisfies FlagEvaluationResult;
          }
        }
        if (ctx.namespace) {
          const nsOverride = map.get(scopeField({ type: "namespace", id: ctx.namespace }));
          if (nsOverride) {
            return {
              value: nsOverride.value,
              reason: "namespace-override",
              override: cloneOverride(nsOverride),
            } satisfies FlagEvaluationResult;
          }
        }

        const segmentResult = this.evaluateSegments(flag, ctx, seedByDefault);
        if (segmentResult) {
          return segmentResult;
        }

        const globalOverride = map.get("global");
        if (globalOverride) {
          return {
            value: globalOverride.value,
            reason: "global-override",
            override: cloneOverride(globalOverride),
          } satisfies FlagEvaluationResult;
        }

        const rolloutResult = this.evaluateRollout(
          flag.rollout,
          ctx,
          key,
          seedByDefault,
          flag.defaultValue,
        );
        if (rolloutResult) return rolloutResult;

        return { value: flag.defaultValue, reason: "default" } satisfies FlagEvaluationResult;
      },
      () => this.memoryFallback.evaluate(key, ctx),
    );
  }

  private evaluateSegments(
    flag: FlagConfig,
    ctx: FlagEvaluationContext,
    seedByDefault: SeedBy,
  ): FlagEvaluationResult | undefined {
    const segments = flag.segments ?? [];
    for (const segment of segments) {
      if (!matchesSegment(segment, ctx)) continue;
      if (typeof segment.override !== "undefined") {
        return { value: segment.override, reason: "segment-override", segmentId: segment.id };
      }
      if (segment.rollout) {
        if (segment.rollout.shadow) {
          continue;
        }
        const result = this.evaluateRollout(
          segment.rollout,
          ctx,
          `${flag.key}:seg:${segment.id}`,
          seedByDefault,
          flag.defaultValue,
        );
        if (result) {
          return {
            ...result,
            reason: "segment-rollout",
            segmentId: segment.id,
          } satisfies FlagEvaluationResult;
        }
      }
    }
    return undefined;
  }

  private evaluateRollout(
    rollout: RolloutStrategy | undefined,
    ctx: FlagEvaluationContext,
    saltKey: string,
    seedByDefault: SeedBy,
    defaultValue: OverrideValue,
  ): FlagEvaluationResult | undefined {
    if (!rollout) return undefined;
    if (rollout.shadow) return undefined;
    const percent = ensurePercent(rollout.percent);
    if (percent >= 100) {
      return { value: defaultValue, reason: "global-rollout" } satisfies FlagEvaluationResult;
    }
    if (percent <= 0) return undefined;
    const seedKey = seedFor(flag.key, ctx, undefined, rollout.seedBy ?? seedByDefault);
    const salt = rollout.salt || saltKey;
    if (pctHit(`${seedKey}:${salt}`, percent)) {
      return { value: defaultValue, reason: "global-rollout" } satisfies FlagEvaluationResult;
    }
    return undefined;
  }

  async snapshot(): Promise<FlagSnapshot> {
    return this.handle(
      async () => {
        const flags = await this.listFlags();
        const overrides: OverrideEntry[] = [];
        for (const flag of flags) {
          const entries = await this.fetchOverrides(flag.key);
          for (const entry of entries) {
            overrides.push(cloneOverride(entry));
          }
        }
        return { flags, overrides } satisfies FlagSnapshot;
      },
      () => this.memoryFallback.snapshot(),
    );
  }
}
