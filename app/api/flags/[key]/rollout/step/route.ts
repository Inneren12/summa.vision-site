import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAdminCsrf } from "@/lib/admin/csrf";
import { beginIdempotentRequest } from "@/lib/admin/idempotency";
import { enforceAdminRateLimit, resolveRolloutStepRpm } from "@/lib/admin/rate-limit";
import { authorizeApi } from "@/lib/admin/rbac";
import { flagToApi, normalizeNamespace } from "@/lib/ff/admin/api";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import type {
  RolloutHysteresis,
  RolloutStopConditions,
  RolloutStrategy,
  SeedBy,
} from "@/lib/ff/runtime/types";
import { FlagConfigSchema } from "@/lib/ff/schema";
import { correlationFromRequest } from "@/lib/metrics/correlation";

export const runtime = "nodejs";

const StopSchema = z
  .object({
    maxErrorRate: z.number().min(0).max(1).optional(),
    maxCLS: z.number().min(0).optional(),
    maxINP: z.number().min(0).optional(),
  })
  .optional();

const HysteresisSchema = z
  .object({
    errorRate: z.number().min(0).max(1).optional(),
    CLS: z.number().min(0).optional(),
    INP: z.number().min(0).optional(),
    cls: z.number().min(0).optional(),
    inp: z.number().min(0).optional(),
  })
  .partial()
  .optional();

const ShadowParamSchema = z
  .union([
    z.boolean(),
    z
      .object({
        pct: z.number().min(0).max(100),
        seedBy: z
          .enum(["stableId", "anonId", "user", "userId", "namespace", "cookie", "ipUa"])
          .optional(),
      })
      .strict(),
  ])
  .optional();

const StepSchema = z.object({
  namespace: z.string().min(1).optional(),
  nextPct: z.number().min(0).max(100),
  stop: StopSchema,
  minSamples: z.number().int().min(0).optional(),
  coolDownMs: z.number().int().min(0).optional(),
  hysteresis: HysteresisSchema,
  dryRun: z.boolean().optional(),
  shadow: ShadowParamSchema,
});

function metricsUnavailable(): NextResponse {
  return NextResponse.json({ error: "Metrics unavailable" }, { status: 412 });
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function metricValue(metrics: Record<string, { p75: number }>, key: string): number | undefined {
  const direct = metrics[key];
  if (direct) return direct.p75;
  const upper = metrics[key.toUpperCase()];
  if (upper) return upper.p75;
  const lower = metrics[key.toLowerCase()];
  if (lower) return lower.p75;
  return undefined;
}

type RawHysteresis = z.infer<typeof HysteresisSchema>;

function normalizeHysteresis(value: RawHysteresis): RolloutHysteresis | undefined {
  if (!value) return undefined;
  const normalized: RolloutHysteresis = {};
  if (typeof value.errorRate === "number") {
    normalized.errorRate = value.errorRate;
  }
  const cls =
    typeof value.CLS === "number"
      ? value.CLS
      : typeof value.cls === "number"
        ? value.cls
        : undefined;
  if (typeof cls === "number") {
    normalized.CLS = cls;
  }
  const inp =
    typeof value.INP === "number"
      ? value.INP
      : typeof value.inp === "number"
        ? value.inp
        : undefined;
  if (typeof inp === "number") {
    normalized.INP = inp;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

type RolloutMetricsSummary = {
  sampleCount: number;
  errorRate: number;
  metrics: Record<string, { p75: number }>;
};

type MetricsSnapshot = {
  denominator: number;
  errorRate?: number;
  cls?: number;
  inp?: number;
};

type EvaluationResult = {
  blocked: boolean;
  reason?: string;
  status?: number;
  limit?: number;
  actual?: number;
  threshold?: number;
  retryInMs?: number;
};

function buildMetrics(summary?: RolloutMetricsSummary): MetricsSnapshot {
  if (!summary) {
    return { denominator: 0 };
  }
  const cls = metricValue(summary.metrics, "CLS");
  const inp = metricValue(summary.metrics, "INP");
  return {
    denominator: summary.sampleCount ?? 0,
    errorRate: summary.errorRate,
    cls: typeof cls === "number" ? cls : undefined,
    inp: typeof inp === "number" ? inp : undefined,
  } satisfies MetricsSnapshot;
}

type ShadowInput = z.infer<typeof ShadowParamSchema>;

function resolveShadowConfig(
  input: ShadowInput,
  targetPct: number,
  current: RolloutStrategy | undefined,
  seedByDefault: SeedBy | undefined,
): { enabled: boolean; config: RolloutStrategy["shadow"] | undefined } {
  const fallbackSeed = current?.shadow?.seedBy ?? current?.seedBy ?? seedByDefault;
  if (typeof input === "boolean") {
    if (input) {
      return { enabled: true, config: { pct: targetPct, seedBy: fallbackSeed } };
    }
    return { enabled: false, config: undefined };
  }
  if (input && typeof input === "object") {
    const pct = clampPercent(input.pct);
    if (pct <= 0) {
      return { enabled: false, config: undefined };
    }
    return { enabled: true, config: { pct, seedBy: input.seedBy ?? fallbackSeed } };
  }
  return { enabled: Boolean(current?.shadow), config: current?.shadow };
}

function evaluateRollout(params: {
  stop?: RolloutStopConditions;
  hysteresis?: RolloutHysteresis;
  summary?: RolloutMetricsSummary;
  minSamples?: number;
  coolDownMs?: number;
  base: number;
  target: number;
  lastStepAt?: number;
  now: number;
}): EvaluationResult {
  const { stop, hysteresis, summary, minSamples, coolDownMs, base, target, lastStepAt, now } =
    params;

  if (!summary) {
    return { blocked: true, reason: "metrics_unavailable", status: 412 };
  }

  const denom = summary.sampleCount ?? 0;
  if (typeof minSamples === "number" && minSamples > 0 && denom < minSamples) {
    return { blocked: true, reason: "min_samples", status: 412 };
  }

  if (typeof coolDownMs === "number" && coolDownMs > 0 && target > base) {
    const last = typeof lastStepAt === "number" && Number.isFinite(lastStepAt) ? lastStepAt : 0;
    if (last > 0) {
      const elapsed = now - last;
      if (elapsed < coolDownMs) {
        return {
          blocked: true,
          reason: "cool_down",
          status: 412,
          retryInMs: Math.max(0, coolDownMs - elapsed),
        };
      }
    }
  }

  if (!stop) {
    return { blocked: false };
  }

  const h = hysteresis ?? {};
  const errorThreshold =
    typeof stop.maxErrorRate === "number"
      ? stop.maxErrorRate + Math.max(0, h.errorRate ?? 0)
      : undefined;
  if (errorThreshold !== undefined && summary.errorRate > errorThreshold) {
    return {
      blocked: true,
      reason: "maxErrorRate",
      status: 409,
      actual: summary.errorRate,
      limit: stop.maxErrorRate,
      threshold: errorThreshold,
    };
  }

  if (typeof stop.maxCLS === "number") {
    const cls = metricValue(summary.metrics, "CLS");
    if (typeof cls !== "number") {
      return { blocked: true, reason: "cls_missing", status: 412 };
    }
    const threshold = stop.maxCLS + Math.max(0, h.CLS ?? 0);
    if (cls > threshold) {
      return {
        blocked: true,
        reason: "maxCLS",
        status: 409,
        actual: cls,
        limit: stop.maxCLS,
        threshold,
      };
    }
  }

  if (typeof stop.maxINP === "number") {
    const inp = metricValue(summary.metrics, "INP");
    if (typeof inp !== "number") {
      return { blocked: true, reason: "inp_missing", status: 412 };
    }
    const threshold = stop.maxINP + Math.max(0, h.INP ?? 0);
    if (inp > threshold) {
      return {
        blocked: true,
        reason: "maxINP",
        status: 409,
        actual: inp,
        limit: stop.maxINP,
        threshold,
      };
    }
  }

  return { blocked: false };
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const csrf = enforceAdminCsrf(req, auth.source);
  if (!csrf.ok) {
    return auth.apply(csrf.response);
  }
  const idempotency = beginIdempotentRequest(req);
  if (idempotency.kind === "error") {
    return auth.apply(idempotency.response);
  }
  if (idempotency.kind === "hit") {
    return auth.apply(idempotency.response);
  }
  const finalize = async (res: NextResponse) => {
    const applied = auth.apply(res);
    await idempotency.store(applied);
    return applied;
  };
  const correlation = correlationFromRequest(req);
  const limit = resolveRolloutStepRpm();
  const gate = await enforceAdminRateLimit({
    req,
    scope: "rollout-step",
    rpm: limit,
    actor: { role: auth.role, session: auth.session },
  });
  if (!gate.ok) {
    return finalize(gate.response);
  }
  const json = await req.json().catch(() => null);
  const parsed = StepSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return finalize(
      NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const {
    namespace: nsInput,
    nextPct,
    stop,
    minSamples,
    coolDownMs,
    hysteresis: rawHysteresis,
    dryRun,
    shadow,
  } = parsed.data;
  const hysteresis = normalizeHysteresis(rawHysteresis);
  const key = params.key;
  const { store, lock, metrics } = FF();
  const existing = await store.getFlag(key);
  if (!existing) {
    return finalize(NextResponse.json({ error: `Flag ${key} not found` }, { status: 404 }));
  }
  if (nsInput) {
    const ns = normalizeNamespace(nsInput);
    if (normalizeNamespace(existing.namespace) !== ns) {
      return finalize(
        NextResponse.json({ error: `Flag ${key} not found in namespace ${ns}` }, { status: 404 }),
      );
    }
  }

  const snapshot = await FF().snapshot();
  const requiresMetrics = (process.env.METRICS_PROVIDER || "self").toLowerCase() === "self";
  const hasData = metrics.hasData(snapshot.id);
  if (requiresMetrics && !hasData) {
    return finalize(metricsUnavailable());
  }
  const summaries = metrics.summarize(snapshot.id);
  const summary = summaries.find((item) => item.snapshotId === snapshot.id);
  const summaryForEval = summary
    ? ({
        sampleCount: summary.sampleCount,
        errorRate: summary.errorRate,
        metrics: summary.metrics,
      } satisfies RolloutMetricsSummary)
    : undefined;
  const currentPct = clampPercent(existing.rollout?.percent ?? 0);
  const targetPct = clampPercent(nextPct);
  const lastRecordedStep = existing.rollout?.steps?.length
    ? existing.rollout.steps[existing.rollout.steps.length - 1]
    : undefined;
  const lastStepAt = lastRecordedStep?.at ?? existing.updatedAt ?? 0;
  const effectiveStop = stop ?? existing.rollout?.stop;
  const effectiveHysteresis = hysteresis ?? existing.rollout?.hysteresis;
  const { enabled: desiredShadowEnabled, config: desiredShadowConfig } = resolveShadowConfig(
    shadow,
    targetPct,
    existing.rollout,
    existing.seedByDefault,
  );
  const evaluation = evaluateRollout({
    stop: effectiveStop,
    hysteresis: effectiveHysteresis,
    summary: summaryForEval,
    minSamples,
    coolDownMs,
    base: currentPct,
    target: targetPct,
    lastStepAt,
    now: Date.now(),
  });
  const metricsSnapshot = buildMetrics(summaryForEval);

  if (dryRun) {
    return finalize(
      NextResponse.json(
        {
          ok: !evaluation.blocked,
          dryRun: true,
          decision: evaluation.blocked ? "hold" : desiredShadowEnabled ? "shadow" : "advance",
          reason: evaluation.reason,
          limit: evaluation.limit,
          actual: evaluation.actual,
          threshold: evaluation.threshold,
          retryInMs: evaluation.retryInMs,
          status: evaluation.status ?? 200,
          metrics: metricsSnapshot,
          currentPct,
          nextPct: targetPct,
          shadow: desiredShadowEnabled,
          shadowCoverage: desiredShadowConfig?.pct,
        },
        { status: 200 },
      ),
    );
  }

  if (evaluation.blocked) {
    if (evaluation.reason === "metrics_unavailable") {
      return finalize(metricsUnavailable());
    }
    const status = evaluation.status ?? 409;
    logAdminAction({
      timestamp: Date.now(),
      actor: auth.role,
      action: "rollout_blocked",
      flag: key,
      reason: evaluation.reason,
      limit: evaluation.limit,
      actual: evaluation.actual,
      errorRate: metricsSnapshot.errorRate,
      cls: metricsSnapshot.cls,
      inp: metricsSnapshot.inp,
      denom: metricsSnapshot.denominator,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      requestNamespace: correlation.namespace,
    });
    return finalize(
      NextResponse.json(
        {
          error: "Rollout blocked",
          reason: evaluation.reason,
          limit: evaluation.limit,
          actual: evaluation.actual,
          threshold: evaluation.threshold,
          retryInMs: evaluation.retryInMs,
          metrics: metricsSnapshot,
        },
        { status },
      ),
    );
  }

  const updated = await lock.withLock(key, async () => {
    const current = await store.getFlag(key);
    if (!current) throw new Error("Flag disappeared");
    const base = clampPercent(current.rollout?.percent ?? 0);
    const target = clampPercent(targetPct);
    const { config: nextShadowConfig } = resolveShadowConfig(
      shadow,
      target,
      current.rollout,
      current.seedByDefault,
    );
    const currentShadowConfig = current.rollout?.shadow;
    const shadowChanged = (() => {
      if (!currentShadowConfig && !nextShadowConfig) return false;
      if (!!currentShadowConfig !== !!nextShadowConfig) return true;
      if (!currentShadowConfig || !nextShadowConfig) return false;
      if (Math.abs(currentShadowConfig.pct - nextShadowConfig.pct) >= 1e-6) return true;
      if (currentShadowConfig.seedBy !== nextShadowConfig.seedBy) return true;
      return false;
    })();
    const percentChanged = Math.abs(base - target) >= 1e-6;
    if (!percentChanged && !shadowChanged) {
      return { flag: current, changed: false } as const;
    }
    const now = Date.now();
    const existingSteps = current.rollout?.steps ?? [];
    const nextSteps = percentChanged ? [...existingSteps, { pct: target, at: now }] : existingSteps;
    const nextConfig = {
      ...current,
      rollout: {
        percent: percentChanged ? target : base,
        salt: current.rollout?.salt,
        seedBy: current.rollout?.seedBy,
        seedByDefault: current.rollout?.seedByDefault ?? current.seedByDefault,
        stop: effectiveStop,
        hysteresis: effectiveHysteresis,
        steps: nextSteps,
        shadow: nextShadowConfig,
      },
      updatedAt: now,
    };
    const parsed = FlagConfigSchema.safeParse(nextConfig);
    if (!parsed.success) {
      return { ok: false, error: parsed.error } as const;
    }
    const saved = await store.putFlag(parsed.data);
    const changed = percentChanged || shadowChanged;
    return { ok: true, flag: saved, changed } as const;
  });

  if (!updated.ok) {
    return finalize(
      NextResponse.json(
        { error: "Flag config invalid", details: updated.error.flatten() },
        { status: 400 },
      ),
    );
  }

  const apiFlag = flagToApi(updated.flag);
  if (!updated.changed) {
    return finalize(
      NextResponse.json({
        ok: true,
        rollout: apiFlag.rollout,
        unchanged: true,
        metrics: metricsSnapshot,
      }),
    );
  }

  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "rollout_step",
    flag: key,
    nextPercent: apiFlag.rollout?.currentPct ?? apiFlag.rollout?.steps?.at(-1)?.pct ?? targetPct,
    shadow: desiredShadowEnabled,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  return finalize(
    NextResponse.json({ ok: true, rollout: apiFlag.rollout, metrics: metricsSnapshot }),
  );
}
