export type Namespace = string; // 'public' | 'tenant:acme'
export type FlagKey = string; // 'feature.newCheckout'
export type Percent = number; // 0..100
export type SeedBy = "userId" | "cookie" | "ipUa" | "anonId";

export type SegmentRule = {
  if: {
    tenant?: string[];
    locale?: string[];
    path?: string[];
    uaIncludes?: string[];
  };
  rollout?: { pct: Percent; seedBy?: SeedBy };
  override?: boolean;
};

export type RolloutPlan = {
  steps: { pct: Percent; note?: string }[];
  stop?: { maxErrorRate?: number; maxCLS?: number; maxINP?: number };
  seedByDefault?: SeedBy;
};

export type FlagConfig = {
  key: FlagKey;
  namespace: Namespace;
  description?: string;
  default: boolean;
  segments?: SegmentRule[];
  rollout?: RolloutPlan;
  tags?: string[];
  killSwitch?: boolean;
  version: number;
};

export type OverrideKey = { flag: FlagKey; namespace?: Namespace; userId?: string };
export type OverrideValue = {
  value: boolean;
  by: string;
  ts: number;
  reason?: string;
  ttlSec?: number;
};

export type Seeds = { userId?: string; cookie?: string; ipUa?: string; anonId?: string };
export type SegCtx = { tenant?: string; locale?: string; path?: string; ua?: string };

export interface FlagStore {
  getFlag(key: FlagKey, ns: Namespace): Promise<FlagConfig | null>;
  putFlag(config: FlagConfig): Promise<void>;
  listFlags(ns?: Namespace): Promise<FlagConfig[]>;
  setOverride(key: OverrideKey, v: OverrideValue): Promise<void>;
  getOverrides(filter: Partial<OverrideKey>): Promise<Record<string, OverrideValue>>;
  setRolloutStep(key: FlagKey, ns: Namespace, pct: Percent): Promise<void>;
  withLock<T>(lockKey: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
}

export interface TelemetrySink {
  emit(e: unknown): Promise<void>;
}

export interface MetricsProvider {
  getErrorRate(flagKey: string, ns: Namespace, windowMs: number): Promise<number | null>;
  getWebVital(
    metric: "CLS" | "INP",
    flagKey: string,
    ns: Namespace,
    windowMs: number,
  ): Promise<number | null>;
}
