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

function getOverrideMap(state: StoreState, flag: string): OverrideMap {
  if (!state.overrides.has(flag)) {
    state.overrides.set(flag, { user: new Map(), namespace: new Map() });
  }
  return state.overrides.get(flag)!;
}

export class MemoryFlagStore implements FlagStore {
  private state: StoreState = {
    flags: new Map(),
    overrides: new Map(),
  };

  listFlags(): FlagConfig[] {
    return Array.from(this.state.flags.values()).map((flag) => cloneConfig(flag));
  }

  getFlag(key: string): FlagConfig | undefined {
    const config = this.state.flags.get(key);
    return config ? cloneConfig(config) : undefined;
  }

  putFlag(config: FlagConfig): FlagConfig {
    const existing = this.state.flags.get(config.key);
    const next: FlagConfig = {
      ...config,
      createdAt: existing?.createdAt ?? config.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      segments: (config.segments ?? [])
        .map((segment) => ({ ...segment, id: segment.id || stableSalt() }))
        .sort((a, b) => a.priority - b.priority),
    };
    this.state.flags.set(next.key, JSON.parse(JSON.stringify(next)) as FlagConfig);
    return cloneConfig(next);
  }

  removeFlag(key: string): void {
    this.state.flags.delete(key);
    this.state.overrides.delete(key);
  }

  listOverrides(flag: string): OverrideEntry[] {
    const map = this.state.overrides.get(flag);
    if (!map) return [];
    const entries: OverrideEntry[] = [];
    for (const value of map.user.values()) entries.push(cloneOverride(value));
    for (const value of map.namespace.values()) entries.push(cloneOverride(value));
    if (map.global) entries.push(cloneOverride(map.global));
    return entries;
  }

  putOverride(entry: OverrideEntry): OverrideEntry {
    const map = getOverrideMap(this.state, entry.flag);
    const stored = { ...entry, updatedAt: Date.now() } satisfies OverrideEntry;
    if (entry.scope.type === "user") {
      map.user.set(entry.scope.id, JSON.parse(JSON.stringify(stored)) as OverrideEntry);
    } else if (entry.scope.type === "namespace") {
      map.namespace.set(entry.scope.id, JSON.parse(JSON.stringify(stored)) as OverrideEntry);
    } else {
      map.global = JSON.parse(JSON.stringify(stored)) as OverrideEntry;
    }
    return cloneOverride(stored);
  }

  removeOverride(flag: string, scope: OverrideScope): void {
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

  evaluate(key: string, ctx: FlagEvaluationContext): FlagEvaluationResult | undefined {
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

  snapshot(): FlagSnapshot {
    return {
      flags: this.listFlags(),
      overrides: Array.from(this.state.overrides.entries()).flatMap(([flag, map]) => {
        const entries: OverrideEntry[] = [];
        for (const entry of map.user.values()) entries.push(cloneOverride(entry));
        for (const entry of map.namespace.values()) entries.push(cloneOverride(entry));
        if (map.global) entries.push(cloneOverride(map.global));
        return entries.map((entry) => ({ ...entry, flag }));
      }),
    };
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
): OverrideEntry {
  return {
    flag,
    scope,
    value,
    author,
    reason,
    updatedAt: Date.now(),
  };
}
