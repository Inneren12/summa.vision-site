export type SeedBy = "stableId" | "anonId" | "user" | "userId" | "namespace" | "cookie" | "ipUa";

export type FlagValue = boolean | string | number | null;

export type RolloutStopConditions = {
  maxErrorRate?: number;
  maxCLS?: number;
  maxINP?: number;
};

export type RolloutHysteresis = {
  errorRate?: number;
  CLS?: number;
  INP?: number;
};

export type RolloutStep = {
  pct: number;
  note?: string;
  at?: number;
};

export type RolloutShadow = {
  pct: number;
  seedBy?: SeedBy;
};

export type RolloutStrategy = {
  percent: number;
  salt?: string;
  seedBy?: SeedBy;
  seedByDefault?: SeedBy;
  steps?: RolloutStep[];
  stop?: RolloutStopConditions;
  hysteresis?: RolloutHysteresis;
  shadow?: RolloutShadow;
};

export type SegmentWhere =
  | { field: string; op: "eq"; value: string | number }
  | { field: string; op: "startsWith"; value: string }
  | { field: string; op: "contains"; value: string }
  | { field: string; op: "in"; values: string[] }
  | { field: string; op: "notIn"; values: string[] }
  | { field: string; op: "gt"; value: number }
  | { field: string; op: "lt"; value: number }
  | { field: string; op: "between"; min: number; max: number }
  | { field: "path"; op: "glob"; value: string };

export type LegacySegmentCondition =
  | { field: "user" | "namespace" | "cookie" | "ip" | "ua"; op: "eq"; value: string }
  | { field: "tag"; op: "eq"; value: string };

export type SegmentConfig = {
  id: string;
  name?: string;
  priority: number;
  where?: SegmentWhere[];
  /** @deprecated Use `where` instead. */
  conditions?: LegacySegmentCondition[];
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
  killValue?: FlagValue;
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
  path?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FlagEvaluationResult = {
  value: FlagValue | undefined;
  reason:
    | "killSwitch"
    | "user-override"
    | "namespace-override"
    | "segment-override"
    | "segment-rollout"
    | "global-override"
    | "global-rollout"
    | "default";
  segmentId?: string;
  override?: OverrideEntry;
  shadowValue?: boolean;
};

export type FlagSnapshot = {
  flags: FlagConfig[];
  overrides: OverrideEntry[];
};

export type FlagStore = {
  listFlags(): Promise<FlagConfig[]>;
  getFlag(key: string): Promise<FlagConfig | undefined>;
  putFlag(config: FlagConfig): Promise<FlagConfig>;
  removeFlag(key: string): Promise<void>;
  listOverrides(flag: string): Promise<OverrideEntry[]>;
  putOverride(entry: OverrideEntry): Promise<OverrideEntry>;
  removeOverride(flag: string, scope: OverrideScope): Promise<void>;
  deleteOverridesByUser(userId: string): Promise<number>;
  evaluate(key: string, ctx: FlagEvaluationContext): Promise<FlagEvaluationResult | undefined>;
  snapshot(): Promise<FlagSnapshot>;
};
