import crypto from "node:crypto";

import murmur from "imurmurhash";

import type {
  FlagConfig,
  FlagEvaluationContext,
  FlagEvaluationResult,
  FlagSnapshot,
  FlagStore,
  OverrideEntry,
  OverrideScope,
  OverrideValue,
  SeedBy,
  SegmentConfig,
} from "./types";

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

function ensurePercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

function stableSalt(): string {
  return crypto.randomBytes(8).toString("hex");
}

function hashToUnit(seed: string): number {
  const h = murmur(seed).result();
  const unsigned = h >>> 0;
  return unsigned / 0xffffffff;
}

function buildSeed(ctx: FlagEvaluationContext, seedBy: SeedBy | undefined): string {
  switch (seedBy) {
    case "user":
    case "userId":
      return ctx.userId || ctx.stableId;
    case "namespace":
      return ctx.namespace || ctx.stableId;
    case "cookie":
      return ctx.cookieId || ctx.stableId;
    case "ipUa": {
      const ip = ctx.ip || "0.0.0.0";
      const ua = ctx.userAgent || "unknown";
      return `${ip}::${ua}`;
    }
    case "anonId":
    case "stableId":
    default:
      return ctx.stableId;
  }
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

type OverrideMap = {
  user: Map<string, OverrideEntry>;
  namespace: Map<string, OverrideEntry>;
  global?: OverrideEntry;
};

type StoreState = {
  flags: Map<string, FlagConfig>;
  overrides: Map<string, OverrideMap>;
};

function pruneExpired(map: OverrideMap, now = Date.now()): void {
  for (const [id, entry] of map.user.entries()) {
    if (isExpired(entry, now)) {
      map.user.delete(id);
    }
  }
  for (const [id, entry] of map.namespace.entries()) {
    if (isExpired(entry, now)) {
      map.namespace.delete(id);
    }
  }
  if (map.global && isExpired(map.global, now)) {
    delete map.global;
  }
}

function getOverrideMap(state: StoreState, flag: string): OverrideMap {
  if (!state.overrides.has(flag)) {
    state.overrides.set(flag, { user: new Map(), namespace: new Map() });
  }
  const map = state.overrides.get(flag)!;
  pruneExpired(map);
  return map;
}

export class MemoryFlagStore implements FlagStore {
  private state: StoreState = {
    flags: new Map(),
    overrides: new Map(),
  };

  async listFlags(): Promise<FlagConfig[]> {
    return Array.from(this.state.flags.values()).map((flag) => cloneConfig(flag));
  }

  async getFlag(key: string): Promise<FlagConfig | undefined> {
    const config = this.state.flags.get(key);
    return config ? cloneConfig(config) : undefined;
  }

  async putFlag(config: FlagConfig): Promise<FlagConfig> {
    const existing = this.state.flags.get(config.key);
    const next: FlagConfig = {
      ...config,
      createdAt: existing?.createdAt ?? config.createdAt ?? Date.now(),
      updatedAt: Number.isFinite(config.updatedAt) ? config.updatedAt! : Date.now(),
      segments: (config.segments ?? [])
        .map((segment) => ({ ...segment, id: segment.id || stableSalt() }))
        .sort((a, b) => a.priority - b.priority),
    };
    this.state.flags.set(next.key, JSON.parse(JSON.stringify(next)) as FlagConfig);
    return cloneConfig(next);
  }

  async removeFlag(key: string): Promise<void> {
    this.state.flags.delete(key);
    this.state.overrides.delete(key);
  }

  async listOverrides(flag: string): Promise<OverrideEntry[]> {
    const map = this.state.overrides.get(flag);
    if (!map) return [];
    pruneExpired(map);
    const entries: OverrideEntry[] = [];
    for (const value of map.user.values()) entries.push(cloneOverride(value));
    for (const value of map.namespace.values()) entries.push(cloneOverride(value));
    if (map.global) entries.push(cloneOverride(map.global));
    return entries;
  }

  async putOverride(entry: OverrideEntry): Promise<OverrideEntry> {
    const map = getOverrideMap(this.state, entry.flag);
    const now = Date.now();
    const expiresAt =
      entry.expiresAt ?? (entry.ttlSeconds ? now + entry.ttlSeconds * 1000 : undefined);
    const stored = {
      ...entry,
      expiresAt,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt! : now,
    } satisfies OverrideEntry;

    if (expiresAt && expiresAt <= now) {
      await this.removeOverride(entry.flag, entry.scope);
      return cloneOverride(stored);
    }
    if (entry.scope.type === "user") {
      map.user.set(entry.scope.id, JSON.parse(JSON.stringify(stored)) as OverrideEntry);
    } else if (entry.scope.type === "namespace") {
      map.namespace.set(entry.scope.id, JSON.parse(JSON.stringify(stored)) as OverrideEntry);
    } else {
      map.global = JSON.parse(JSON.stringify(stored)) as OverrideEntry;
    }
    return cloneOverride(stored);
  }

  async removeOverride(flag: string, scope: OverrideScope): Promise<void> {
    const map = this.state.overrides.get(flag);
    if (!map) return;
    if (scope.type === "user") {
      map.user.delete(scope.id);
    } else if (scope.type === "namespace") {
      map.namespace.delete(scope.id);
    } else {
      delete map.global;
    }
  }

  async deleteOverridesByUser(userId: string): Promise<number> {
    let removed = 0;
    for (const map of this.state.overrides.values()) {
      pruneExpired(map);
      if (map.user.delete(userId)) {
        removed += 1;
      }
    }
    return removed;
  }

  async evaluate(
    key: string,
    ctx: FlagEvaluationContext,
  ): Promise<FlagEvaluationResult | undefined> {
    const flag = this.state.flags.get(key);
    if (!flag || !flag.enabled) return undefined;

    if (flag.kill || process.env.FF_KILL_ALL === "true") {
      return {
        value: typeof flag.defaultValue === "boolean" ? false : flag.defaultValue,
        reason: "kill",
      };
    }

    const overrides = this.state.overrides.get(key);
    const seedByDefault = flag.seedByDefault ?? "stableId";
    if (overrides) {
      pruneExpired(overrides);
      const userOverride = ctx.userId ? overrides.user.get(ctx.userId) : undefined;
      if (userOverride) {
        return {
          value: userOverride.value,
          reason: "user-override",
          override: cloneOverride(userOverride),
        };
      }
      const nsOverride = ctx.namespace ? overrides.namespace.get(ctx.namespace) : undefined;
      if (nsOverride) {
        return {
          value: nsOverride.value,
          reason: "namespace-override",
          override: cloneOverride(nsOverride),
        };
      }
    }

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
        const percent = ensurePercent(segment.rollout.percent);
        if (percent <= 0) continue;
        if (percent >= 100) {
          return { value: flag.defaultValue, reason: "segment-rollout", segmentId: segment.id };
        }
        const seedKey = buildSeed(ctx, segment.rollout.seedBy ?? seedByDefault);
        const salt = segment.rollout.salt || `${key}:seg:${segment.id}`;
        const unit = hashToUnit(`${seedKey}:${salt}`);
        if (unit * 100 < percent) {
          return { value: flag.defaultValue, reason: "segment-rollout", segmentId: segment.id };
        }
      }
    }

    if (overrides?.global) {
      return {
        value: overrides.global.value,
        reason: "global-override",
        override: cloneOverride(overrides.global),
      };
    }

    if (flag.rollout) {
      if (flag.rollout.shadow) {
        return { value: flag.defaultValue, reason: "default" };
      }
      const percent = ensurePercent(flag.rollout.percent);
      if (percent >= 100) {
        return { value: flag.defaultValue, reason: "global-rollout" };
      }
      if (percent > 0) {
        const seedKey = buildSeed(ctx, flag.rollout.seedBy ?? seedByDefault);
        const salt = flag.rollout.salt || `${key}:global`;
        const unit = hashToUnit(`${seedKey}:${salt}`);
        if (unit * 100 < percent) {
          return { value: flag.defaultValue, reason: "global-rollout" };
        }
      }
    }

    return { value: flag.defaultValue, reason: "default" };
  }

  async snapshot(): Promise<FlagSnapshot> {
    const flags = await this.listFlags();
    const overrides: OverrideEntry[] = [];
    for (const map of this.state.overrides.values()) {
      pruneExpired(map);
      for (const entry of map.user.values()) overrides.push(cloneOverride(entry));
      for (const entry of map.namespace.values()) overrides.push(cloneOverride(entry));
      if (map.global) overrides.push(cloneOverride(map.global));
    }
    return { flags, overrides } satisfies FlagSnapshot;
  }

  replaceSnapshot(snapshot: FlagSnapshot): void {
    this.state.flags.clear();
    this.state.overrides.clear();
    for (const flag of snapshot.flags) {
      const clone = JSON.parse(JSON.stringify(flag)) as FlagConfig;
      this.state.flags.set(clone.key, clone);
    }
    for (const entry of snapshot.overrides) {
      const clone = JSON.parse(JSON.stringify(entry)) as OverrideEntry;
      const map = getOverrideMap(this.state, clone.flag);
      const now = Date.now();
      if (clone.expiresAt && clone.expiresAt <= now) {
        continue;
      }
      if (clone.scope.type === "user") {
        map.user.set(clone.scope.id, clone);
      } else if (clone.scope.type === "namespace") {
        map.namespace.set(clone.scope.id, clone);
      } else {
        map.global = clone;
      }
    }
  }
}

export function createInitialConfig(key: string): FlagConfig {
  const now = Date.now();
  return {
    key,
    enabled: true,
    defaultValue: false,
    createdAt: now,
    updatedAt: now,
    rollout: undefined,
    segments: [],
  };
}

export function createOverride(
  flag: string,
  scope: OverrideScope,
  value: OverrideValue,
  author?: string,
  reason?: string,
  ttlSeconds?: number,
): OverrideEntry {
  return {
    flag,
    scope,
    value,
    author,
    reason,
    ttlSeconds,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    updatedAt: Date.now(),
  };
}
