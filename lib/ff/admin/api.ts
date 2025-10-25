import { legacyConditionToWhere, normalizeSegmentWhere } from "../runtime/segment-match";
import type {
  FlagConfig,
  RolloutHysteresis,
  RolloutStep,
  RolloutStopConditions,
  SeedBy,
  SegmentConfig,
  SegmentWhere,
} from "../runtime/types";

const FIELD_TO_API_KEY: Record<string, string> = {
  user: "userId",
  namespace: "namespace",
  cookie: "cookie",
  ip: "ip",
  ua: "ua",
  tag: "tag",
};

const API_KEY_TO_FIELD: Record<string, string> = {
  userId: "user",
  namespace: "namespace",
  cookie: "cookie",
  ip: "ip",
  ua: "ua",
  tag: "tag",
};

export type ApiSeedBy = "userId" | "cookie" | "ipUa" | "anonId" | "stableId";

export type ApiRolloutStep = {
  pct: number;
  note?: string;
  at?: number;
};

export type ApiRollout = {
  currentPct?: number;
  steps?: ApiRolloutStep[];
  seedByDefault?: ApiSeedBy;
  stop?: RolloutStopConditions;
  hysteresis?: RolloutHysteresis;
  shadow?: boolean;
};

export type ApiSegment = {
  if?: Record<string, string | string[]>;
  where?: SegmentWhere[];
  rollout?: { pct: number; seedBy?: ApiSeedBy };
  override?: boolean;
};

export type ApiFlagConfig = {
  key: string;
  namespace: string;
  default: boolean;
  version: number;
  description?: string;
  tags?: string[];
  killSwitch?: boolean;
  killValue?: boolean | string | number | null;
  rollout?: ApiRollout;
  segments?: ApiSegment[];
  createdAt?: number;
  updatedAt?: number;
};

export function normalizeNamespace(ns?: string): string {
  if (typeof ns === "string" && ns.trim()) return ns.trim();
  return "default";
}

function clampPercent(value: number | undefined): number {
  if (!Number.isFinite(value || 0)) return 0;
  return Math.min(100, Math.max(0, value ?? 0));
}

function toApiSeed(seed?: SeedBy): ApiSeedBy | undefined {
  switch (seed) {
    case "cookie":
      return "cookie";
    case "ipUa":
      return "ipUa";
    case "user":
    case "userId":
      return "userId";
    case "anonId":
    case "stableId":
      return seed === "stableId" ? "stableId" : "anonId";
    default:
      return undefined;
  }
}

function fromApiSeed(seed?: ApiSeedBy): SeedBy | undefined {
  switch (seed) {
    case "cookie":
      return "cookie";
    case "ipUa":
      return "ipUa";
    case "userId":
      return "userId";
    case "anonId":
      return "anonId";
    case "stableId":
      return "stableId";
    default:
      return undefined;
  }
}

function whereToRecord(where?: SegmentWhere[]): Record<string, string | string[]> | undefined {
  if (!where || where.length === 0) return undefined;
  const record: Record<string, Set<string>> = {};
  for (const clause of where) {
    const key = FIELD_TO_API_KEY[clause.field];
    if (!key) continue;
    if (clause.op === "eq" && typeof clause.value === "string") {
      record[key] ??= new Set();
      record[key]!.add(clause.value);
    } else if (clause.op === "in") {
      record[key] ??= new Set();
      for (const value of clause.values) {
        if (typeof value === "string" && value.trim()) {
          record[key]!.add(value);
        }
      }
    }
  }
  if (Object.keys(record).length === 0) return undefined;
  const output: Record<string, string | string[]> = {};
  for (const [apiKey, values] of Object.entries(record)) {
    output[apiKey] = values.size === 1 ? [...values][0] : [...values];
  }
  return Object.keys(output).length ? output : undefined;
}

function recordToWhere(record?: Record<string, string | string[]>): SegmentWhere[] | undefined {
  if (!record) return undefined;
  const out: SegmentWhere[] = [];
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const field = API_KEY_TO_FIELD[rawKey];
    if (!field) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value !== "string" || !value.trim()) continue;
      out.push({ field, op: "eq", value: value.trim() });
    }
  }
  return out.length ? out : undefined;
}

function toApiSegment(segment: SegmentConfig): ApiSegment {
  const where = normalizeSegmentWhere(segment);
  const override = typeof segment.override === "boolean" ? segment.override : undefined;
  const rolloutPct = segment.rollout ? clampPercent(segment.rollout.percent) : undefined;
  return {
    if: whereToRecord(where),
    where: where && where.length ? where : undefined,
    override,
    rollout:
      rolloutPct !== undefined
        ? { pct: rolloutPct, seedBy: toApiSeed(segment.rollout?.seedBy) }
        : undefined,
  } satisfies ApiSegment;
}

function toRolloutSteps(steps?: RolloutStep[]): ApiRolloutStep[] | undefined {
  if (!steps) return undefined;
  return steps.map((step) => ({
    pct: clampPercent(step.pct ?? step.percent ?? 0),
    note: step.note,
    at: step.at,
  }));
}

export function flagToApi(flag: FlagConfig): ApiFlagConfig {
  const namespace = normalizeNamespace(flag.namespace);
  const currentPct = clampPercent(flag.rollout?.percent ?? 0);
  const rollout: ApiRollout | undefined = flag.rollout
    ? {
        currentPct,
        steps: toRolloutSteps(flag.rollout.steps),
        seedByDefault: toApiSeed(flag.rollout.seedByDefault ?? flag.seedByDefault),
        stop: flag.rollout.stop,
        hysteresis: flag.rollout.hysteresis,
        shadow: flag.rollout.shadow,
      }
    : undefined;
  const segments = flag.segments?.length ? flag.segments.map(toApiSegment) : undefined;
  const kill = typeof flag.killSwitch === "boolean" ? flag.killSwitch : flag.kill;
  const defaultValue =
    typeof flag.defaultValue === "boolean" ? flag.defaultValue : Boolean(flag.defaultValue);
  return {
    key: flag.key,
    namespace,
    default: defaultValue,
    version: flag.version ?? 1,
    description: flag.description,
    tags: flag.tags,
    killSwitch: kill,
    killValue: flag.killValue,
    rollout,
    segments,
    createdAt: flag.createdAt,
    updatedAt: flag.updatedAt,
  } satisfies ApiFlagConfig;
}

function mergeSegment(segment: ApiSegment, index: number, existing?: SegmentConfig): SegmentConfig {
  const priority = existing?.priority ?? index;
  const existingWhere =
    existing?.where ??
    (existing?.conditions
      ? existing.conditions.map((condition) => legacyConditionToWhere(condition))
      : undefined);
  const where =
    segment.where && segment.where.length
      ? segment.where
      : (recordToWhere(segment.if) ?? existingWhere);
  const override = typeof segment.override === "boolean" ? segment.override : existing?.override;
  const rollout = segment.rollout
    ? {
        percent: clampPercent(segment.rollout.pct),
        seedBy: fromApiSeed(segment.rollout.seedBy) ?? existing?.rollout?.seedBy,
        salt: existing?.rollout?.salt,
      }
    : existing?.rollout;
  return {
    id: existing?.id ?? "",
    priority,
    where,
    override,
    rollout,
    namespace: existing?.namespace,
  } satisfies SegmentConfig;
}

function normalizeSteps(
  steps?: ApiRolloutStep[],
  existing?: RolloutStep[],
): RolloutStep[] | undefined {
  if (!steps) return existing;
  return steps.map((step, idx) => ({
    pct: clampPercent(step.pct),
    note: step.note,
    at: step.at ?? existing?.[idx]?.at ?? Date.now(),
  }));
}

export function apiToFlag(payload: ApiFlagConfig, existing?: FlagConfig): FlagConfig {
  const namespace = normalizeNamespace(payload.namespace);
  const now = Date.now();
  const createdAt = existing?.createdAt ?? payload.createdAt ?? now;
  const version = payload.version ?? (existing?.version ?? 0) + 1;
  const segments = payload.segments?.map((segment, index) =>
    mergeSegment(segment, index, existing?.segments?.[index]),
  );
  const currentPct = payload.rollout?.currentPct ?? payload.rollout?.steps?.at(-1)?.pct;
  const rolloutPercent = clampPercent(
    currentPct !== undefined ? currentPct : (existing?.rollout?.percent ?? 0),
  );
  const rollout = payload.rollout
    ? {
        percent: rolloutPercent,
        salt: existing?.rollout?.salt,
        seedBy: existing?.rollout?.seedBy,
        seedByDefault:
          fromApiSeed(payload.rollout.seedByDefault) ??
          existing?.rollout?.seedByDefault ??
          existing?.seedByDefault,
        steps: normalizeSteps(payload.rollout.steps, existing?.rollout?.steps),
        stop: payload.rollout.stop ?? existing?.rollout?.stop,
        hysteresis: payload.rollout.hysteresis ?? existing?.rollout?.hysteresis,
        shadow: Object.prototype.hasOwnProperty.call(payload.rollout, "shadow")
          ? payload.rollout.shadow
          : existing?.rollout?.shadow,
      }
    : existing?.rollout;

  const defaultValue = payload.default;
  const killSwitch = payload.killSwitch ?? existing?.killSwitch ?? existing?.kill ?? false;
  const killValue = payload.killValue !== undefined ? payload.killValue : existing?.killValue;

  return {
    key: payload.key,
    namespace,
    version,
    description: payload.description ?? existing?.description,
    enabled: existing?.enabled ?? true,
    kill: killSwitch,
    killSwitch,
    killValue,
    seedByDefault: rollout?.seedByDefault ?? existing?.seedByDefault,
    defaultValue,
    tags: payload.tags ?? existing?.tags,
    rollout,
    segments,
    createdAt,
    updatedAt: now,
  } satisfies FlagConfig;
}
