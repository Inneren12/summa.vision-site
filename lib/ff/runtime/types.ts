export type SeedBy = "stableId" | "anonId" | "user" | "userId" | "namespace" | "cookie" | "ipUa";

export type RolloutStopConditions = {
  maxErrorRate?: number;
  maxCLS?: number;
  maxINP?: number;
};

export type RolloutStep = {
  pct: number;
  note?: string;
  at?: number;
};

export type RolloutStrategy = {
  percent: number;
  salt?: string;
  seedBy?: SeedBy;
  seedByDefault?: SeedBy;
  steps?: RolloutStep[];
  stop?: RolloutStopConditions;
};

export type SegmentCondition =
  | { field: "user" | "namespace" | "cookie" | "ip" | "ua"; op: "eq"; value: string }
  | { field: "tag"; op: "eq"; value: string };

export type SegmentConfig = {
  id: string;
  name?: string;
  priority: number;
  conditions?: SegmentCondition[];
  override?: boolean | string | number;
  rollout?: RolloutStrategy;
  namespace?: string;
};

export type FlagConfig = {
  key: string;
  namespace?: string;
  version?: number;
  description?: string;
  enabled: boolean;
  kill?: boolean;
  killSwitch?: boolean;
  seedByDefault?: SeedBy;
  defaultValue: boolean | string | number;
  tags?: string[];
  rollout?: RolloutStrategy;
  segments?: SegmentConfig[];
  createdAt: number;
  updatedAt: number;
};

export type OverrideScope =
  | { type: "user"; id: string }
  | { type: "namespace"; id: string }
  | { type: "global" };

export type OverrideValue = boolean | string | number;

export type OverrideEntry = {
  flag: string;
  scope: OverrideScope;
  value: OverrideValue;
  reason?: string;
  author?: string;
  ttlSeconds?: number;
  expiresAt?: number;
  updatedAt: number;
};

export type FlagEvaluationContext = {
  stableId: string;
  userId?: string;
  namespace?: string;
  cookieId?: string;
  ip?: string;
  userAgent?: string;
  tags?: string[];
};

export type FlagEvaluationResult = {
  value: boolean | string | number;
  reason:
    | "kill"
    | "user-override"
    | "namespace-override"
    | "segment-override"
    | "segment-rollout"
    | "global-override"
    | "global-rollout"
    | "default";
  segmentId?: string;
  override?: OverrideEntry;
};

export type FlagSnapshot = {
  flags: FlagConfig[];
  overrides: OverrideEntry[];
};

export type FlagStore = {
  listFlags(): FlagConfig[];
  getFlag(key: string): FlagConfig | undefined;
  putFlag(config: FlagConfig): FlagConfig;
  removeFlag(key: string): void;
  listOverrides(flag: string): OverrideEntry[];
  putOverride(entry: OverrideEntry): OverrideEntry;
  removeOverride(flag: string, scope: OverrideScope): void;
  evaluate(key: string, ctx: FlagEvaluationContext): FlagEvaluationResult | undefined;
  snapshot(): FlagSnapshot;
};
