import { percentFor, seedFor } from "../bucketing";

import { matchesSegment } from "./segment-match";
import type { FlagConfig, FlagValue, OverrideValue, RolloutStrategy, SeedBy } from "./types";

export type EvaluateFlagSeeds = {
  stableId?: string;
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
  path?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
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
  value: FlagValue | undefined;
  reason: EvaluateFlagReason;
  segmentId?: string;
  shadowValue?: boolean;
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
  path?: string;
  attributes?: Record<string, unknown>;
} & Record<string, unknown>;

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
  const stableId = seeds?.stableId ?? seeds?.anonId ?? ctx?.stableId ?? "anon";
  return {
    ...(ctx ?? {}),
    stableId,
    userId: ctx?.userId ?? seeds?.userId,
    namespace: ctx?.namespace ?? seeds?.namespace,
    cookieId: ctx?.cookieId ?? seeds?.cookie,
    ip: ctx?.ip ?? seeds?.ip,
    userAgent: ctx?.userAgent ?? seeds?.userAgent,
    tags: ctx?.tags,
    path: ctx?.path,
    attributes: ctx?.attributes,
  } satisfies EffectiveContext;
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
  let shadowValue: boolean | undefined;

  const recordShadow = (
    shadow: RolloutStrategy["shadow"],
    salt: string,
    fallbackSeedBy: SeedBy,
    segmentId?: string,
  ) => {
    if (!shadow) return;
    shadowValue = shadowValue ?? false;
    const pct = ensurePercent(shadow.pct);
    if (pct <= 0) return;
    const seed = seedFor(cfg.key, effectiveCtx, seeds, shadow.seedBy ?? fallbackSeedBy);
    const bucket = percentFn({
      seed,
      salt,
      percent: pct,
      flagKey: cfg.key,
      segmentId,
    });
    if (bucket < pct) {
      shadowValue = true;
    }
  };

  const withShadow = <T extends Record<string, unknown>>(
    result: T,
  ): T & { shadowValue?: boolean } => {
    if (typeof shadowValue === "boolean") {
      return { ...result, shadowValue };
    }
    return result;
  };

  const killSwitchActive = (cfg as { killSwitch?: boolean }).killSwitch ?? cfg.kill ?? false;
  const globalKillActive = process.env.FF_KILL_ALL === "true";
  if (killSwitchActive || globalKillActive) {
    if (typeof cfg.defaultValue === "boolean") {
      return withShadow({ value: false, reason: "killSwitch" });
    }
    const killValue = cfg.killValue !== undefined ? cfg.killValue : undefined;
    return withShadow({ value: killValue, reason: "killSwitch" });
  }

  if (hasOverrideValue(overrides?.user, effectiveCtx.userId)) {
    const value = overrides!.user![effectiveCtx.userId!];
    return withShadow({ value, reason: "userOverride" });
  }

  if (hasOverrideValue(overrides?.namespace, effectiveCtx.namespace)) {
    const value = overrides!.namespace![effectiveCtx.namespace!];
    return withShadow({ value, reason: "nsOverride" });
  }

  const segments = [...(cfg.segments ?? [])].sort((a, b) => a.priority - b.priority);
  for (const segment of segments) {
    if (!matchesSegment(segment, effectiveCtx)) continue;

    if (typeof segment.override !== "undefined") {
      return withShadow({
        value: segment.override,
        reason: "segmentOverride",
        segmentId: segment.id,
      } satisfies EvaluateFlagResult);
    }

    if (segment.rollout) {
      const percent = ensurePercent(segment.rollout.percent);
      const fallbackSeed = segment.rollout.seedBy ?? seedByDefault;
      recordShadow(
        segment.rollout.shadow,
        `${segment.rollout.salt || `${cfg.key}:segment:${segment.id}`}:shadow`,
        fallbackSeed,
        segment.id,
      );
      if (percent <= 0) continue;
      if (percent >= 100) {
        return withShadow({
          value: cfg.defaultValue,
          reason: "segmentRollout",
          segmentId: segment.id,
        } satisfies EvaluateFlagResult);
      }
      const seed = seedFor(cfg.key, effectiveCtx, seeds, fallbackSeed);
      const salt = segment.rollout.salt || `${cfg.key}:segment:${segment.id}`;
      const bucket = percentFn({
        seed,
        salt,
        percent,
        flagKey: cfg.key,
        segmentId: segment.id,
      });
      if (bucket < percent) {
        return withShadow({
          value: cfg.defaultValue,
          reason: "segmentRollout",
          segmentId: segment.id,
        } satisfies EvaluateFlagResult);
      }
    }
  }

  if (cfg.rollout) {
    const percent = ensurePercent(cfg.rollout.percent);
    const fallbackSeed = cfg.rollout.seedBy ?? seedByDefault;
    recordShadow(
      cfg.rollout.shadow,
      `${cfg.rollout.salt || `${cfg.key}:global`}:shadow`,
      fallbackSeed,
    );
    if (percent >= 100) {
      return withShadow({ value: cfg.defaultValue, reason: "globalRollout" });
    }
    if (percent > 0) {
      const seed = seedFor(cfg.key, effectiveCtx, seeds, fallbackSeed);
      const salt = cfg.rollout.salt || `${cfg.key}:global`;
      const bucket = percentFn({
        seed,
        salt,
        percent,
        flagKey: cfg.key,
      });
      if (bucket < percent) {
        return withShadow({ value: cfg.defaultValue, reason: "globalRollout" });
      }
    }
  }

  return withShadow({ value: cfg.defaultValue, reason: "default" });
}
