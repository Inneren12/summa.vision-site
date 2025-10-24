import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeApi } from "@/lib/admin/rbac";
import { flagToApi, normalizeNamespace } from "@/lib/ff/admin/api";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import type { RolloutStopConditions } from "@/lib/ff/runtime/types";

export const runtime = "nodejs";

const StopSchema = z
  .object({
    maxErrorRate: z.number().min(0).max(1).optional(),
    maxCLS: z.number().min(0).optional(),
    maxINP: z.number().min(0).optional(),
  })
  .optional();

const StepSchema = z.object({
  namespace: z.string().min(1).optional(),
  nextPct: z.number().min(0).max(100),
  stop: StopSchema,
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

function violatesStops(
  stop: RolloutStopConditions | undefined,
  summary?: {
    errorRate: number;
    metrics: Record<string, { p75: number }>;
  },
): { blocked: boolean; reason?: string; actual?: number; limit?: number } {
  if (!stop) return { blocked: false };
  if (!summary) return { blocked: true, reason: "metrics_unavailable" };
  if (typeof stop.maxErrorRate === "number" && summary.errorRate > stop.maxErrorRate) {
    return {
      blocked: true,
      reason: "maxErrorRate",
      actual: summary.errorRate,
      limit: stop.maxErrorRate,
    };
  }
  if (typeof stop.maxCLS === "number") {
    const cls = metricValue(summary.metrics, "CLS");
    if (typeof cls === "number" && cls > stop.maxCLS) {
      return { blocked: true, reason: "maxCLS", actual: cls, limit: stop.maxCLS };
    }
    if (cls === undefined) {
      return { blocked: true, reason: "cls_missing" };
    }
  }
  if (typeof stop.maxINP === "number") {
    const inp = metricValue(summary.metrics, "INP");
    if (typeof inp === "number" && inp > stop.maxINP) {
      return { blocked: true, reason: "maxINP", actual: inp, limit: stop.maxINP };
    }
    if (inp === undefined) {
      return { blocked: true, reason: "inp_missing" };
    }
  }
  return { blocked: false };
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = StepSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return auth.apply(
      NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const { namespace: nsInput, nextPct, stop } = parsed.data;
  const key = params.key;
  const { store, lock, metrics } = FF();
  const existing = store.getFlag(key);
  if (!existing) {
    return auth.apply(NextResponse.json({ error: `Flag ${key} not found` }, { status: 404 }));
  }
  if (nsInput) {
    const ns = normalizeNamespace(nsInput);
    if (normalizeNamespace(existing.namespace) !== ns) {
      return auth.apply(
        NextResponse.json({ error: `Flag ${key} not found in namespace ${ns}` }, { status: 404 }),
      );
    }
  }

  const snapshot = FF().snapshot();
  const requiresMetrics = (process.env.METRICS_PROVIDER || "self").toLowerCase() === "self";
  const hasData = metrics.hasData(snapshot.id);
  if (requiresMetrics && !hasData) {
    return auth.apply(metricsUnavailable());
  }
  const summaries = metrics.summarize(snapshot.id);
  const summary = summaries.find((item) => item.snapshotId === snapshot.id);
  const stopCheck = violatesStops(stop, summary);
  if (stopCheck.blocked) {
    if (stopCheck.reason === "metrics_unavailable") {
      return auth.apply(metricsUnavailable());
    }
    logAdminAction({
      timestamp: Date.now(),
      actor: auth.role,
      action: "rollout_blocked",
      flag: key,
      reason: stopCheck.reason,
      limit: stopCheck.limit,
      actual: stopCheck.actual,
    });
    return auth.apply(
      NextResponse.json(
        {
          error: "Rollout blocked",
          reason: stopCheck.reason,
          limit: stopCheck.limit,
          actual: stopCheck.actual,
        },
        { status: 409 },
      ),
    );
  }

  const updated = await lock.withLock(key, async () => {
    const current = store.getFlag(key);
    if (!current) throw new Error("Flag disappeared");
    const base = clampPercent(current.rollout?.percent ?? 0);
    const target = clampPercent(nextPct);
    if (Math.abs(base - target) < 1e-6) {
      return { flag: current, changed: false } as const;
    }
    const now = Date.now();
    const existingSteps = current.rollout?.steps ?? [];
    const nextSteps = [...existingSteps, { pct: target, at: now }];
    const nextConfig = {
      ...current,
      rollout: {
        percent: target,
        salt: current.rollout?.salt,
        seedBy: current.rollout?.seedBy,
        seedByDefault: current.rollout?.seedByDefault ?? current.seedByDefault,
        stop: stop ?? current.rollout?.stop,
        steps: nextSteps,
      },
      updatedAt: now,
    };
    const saved = store.putFlag(nextConfig);
    return { flag: saved, changed: true } as const;
  });

  const apiFlag = flagToApi(updated.flag);
  if (!updated.changed) {
    return auth.apply(NextResponse.json({ ok: true, rollout: apiFlag.rollout, unchanged: true }));
  }

  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "rollout_step",
    flag: key,
    nextPercent: apiFlag.rollout?.currentPct ?? apiFlag.rollout?.steps?.at(-1)?.pct ?? nextPct,
  });
  return auth.apply(NextResponse.json({ ok: true, rollout: apiFlag.rollout }));
}
