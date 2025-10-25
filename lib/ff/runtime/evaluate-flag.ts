import { percentFor, seedFor } from "../bucketing";

import type { FlagConfig, FlagValue, OverrideValue, SegmentConfig } from "./types";

export type EvaluateFlagSeeds = {
  anonId?: string;
  userId?: string;
  namespace?: string;
  cookie?: string;
  ip?: string;
  userAgent?: string;
  ipUa?: string;
};

export type EvaluateFlagContext = {
  stableId?: string;
  userId?: string;
  namespace?: string;
  cookieId?: string;
  ip?: string;
  userAgent?: string;
  tags?: string[];
};

export type EvaluateFlagOverrides = {
  user?: Record<string, OverrideValue>;
  namespace?: Record<string, OverrideValue>;
};

export type EvaluateFlagReason =
  | "killSwitch"
  | "userOverride"
  | "nsOverride"
  | "segmentOverride"
  | "segmentRollout"
  | "globalRollout"
  | "default";

export type EvaluateFlagResult = {
  value: OverrideValue;
  reason: EvaluateFlagReason;
  segmentId?: string;
};

export type RolloutComputationInput = {
  seed: string;
  salt: string;
  percent: number;
  flagKey: string;
  segmentId?: string;
};

export type RolloutPercentFn = (input: RolloutComputationInput) => number;

export type EvaluateFlagOptions = {
  cfg: FlagConfig;
  seeds?: EvaluateFlagSeeds;
  ctx?: EvaluateFlagContext;
  overrides?: EvaluateFlagOverrides;
  rolloutPct?: RolloutPercentFn;
};

type EffectiveContext = {
  stableId: string;
  userId?: string;
  namespace?: string;
  cookieId?: string;
  ip?: string;
  userAgent?: string;
  tags?: string[];
};

function ensurePercent(percent: number | undefined): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent ?? 0));
}

function defaultRolloutPercent({ seed, salt }: RolloutComputationInput): number {
  return percentFor(`${seed}:${salt}`);
}

function buildEffectiveContext(
  ctx: EvaluateFlagContext | undefined,
  seeds: EvaluateFlagSeeds | undefined,
): EffectiveContext {
  const anonId =
    seeds?.anonId ?? ctx?.stableId ?? seeds?.userId ?? seeds?.cookie ?? seeds?.namespace ?? "anon";
  return {
    stableId: anonId,
    userId: ctx?.userId ?? seeds?.userId,
    namespace: ctx?.namespace ?? seeds?.namespace,
    cookieId: ctx?.cookieId ?? seeds?.cookie,
    ip: ctx?.ip ?? seeds?.ip,
    userAgent: ctx?.userAgent ?? seeds?.userAgent,
    tags: ctx?.tags,
  } satisfies EffectiveContext;
}

function matchesSegment(segment: SegmentConfig, ctx: EffectiveContext): boolean {
  if (!segment.conditions || segment.conditions.length === 0) {
    return true;
  }
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

function hasOverrideValue(
  overrides: Record<string, OverrideValue> | undefined,
  key: string | undefined,
): key is string {
  if (!key || !overrides) return false;
  return Object.prototype.hasOwnProperty.call(overrides, key);
}

export function evaluateFlag(options: EvaluateFlagOptions): EvaluateFlagResult {
  const { cfg, seeds, ctx, overrides, rolloutPct } = options;
  const percentFn = rolloutPct ?? defaultRolloutPercent;
  const effectiveCtx = buildEffectiveContext(ctx, seeds);
  const seedByDefault = cfg.seedByDefault ?? "stableId";

  const killSwitchActive = (cfg as { killSwitch?: boolean }).killSwitch ?? cfg.kill ?? false;
  if (killSwitchActive) {
    const killValue: FlagValue =
      cfg.killValue !== undefined
        ? cfg.killValue
        : typeof cfg.defaultValue === "boolean"
          ? false
          : cfg.defaultValue;
    return { value: killValue, reason: "killSwitch" };
  }

  if (hasOverrideValue(overrides?.user, effectiveCtx.userId)) {
    const value = overrides!.user![effectiveCtx.userId!];
    return { value, reason: "userOverride" };
  }

  if (hasOverrideValue(overrides?.namespace, effectiveCtx.namespace)) {
    const value = overrides!.namespace![effectiveCtx.namespace!];
    return { value, reason: "nsOverride" };
  }

  const segments = [...(cfg.segments ?? [])].sort((a, b) => a.priority - b.priority);
  for (const segment of segments) {
    if (!matchesSegment(segment, effectiveCtx)) continue;

    if (typeof segment.override !== "undefined") {
      return {
        value: segment.override,
        reason: "segmentOverride",
        segmentId: segment.id,
      } satisfies EvaluateFlagResult;
    }

    if (segment.rollout) {
      const percent = ensurePercent(segment.rollout.percent);
      if (percent <= 0) continue;
      if (percent >= 100) {
        return {
          value: cfg.defaultValue,
          reason: "segmentRollout",
          segmentId: segment.id,
        } satisfies EvaluateFlagResult;
      }
      const seed = seedFor(cfg.key, effectiveCtx, seeds, segment.rollout.seedBy ?? seedByDefault);
      const salt = segment.rollout.salt || `${cfg.key}:segment:${segment.id}`;
      const bucket = percentFn({
        seed,
        salt,
        percent,
        flagKey: cfg.key,
        segmentId: segment.id,
      });
      if (bucket < percent) {
        return {
          value: cfg.defaultValue,
          reason: "segmentRollout",
          segmentId: segment.id,
        } satisfies EvaluateFlagResult;
      }
    }
  }

  if (cfg.rollout) {
    const percent = ensurePercent(cfg.rollout.percent);
    if (percent >= 100) {
      return { value: cfg.defaultValue, reason: "globalRollout" };
    }
    if (percent > 0) {
      const seed = seedFor(cfg.key, effectiveCtx, seeds, cfg.rollout.seedBy ?? seedByDefault);
      const salt = cfg.rollout.salt || `${cfg.key}:global`;
      const bucket = percentFn({
        seed,
        salt,
        percent,
        flagKey: cfg.key,
      });
      if (bucket < percent) {
        return { value: cfg.defaultValue, reason: "globalRollout" };
      }
    }
  }

  return { value: cfg.defaultValue, reason: "default" };
}
