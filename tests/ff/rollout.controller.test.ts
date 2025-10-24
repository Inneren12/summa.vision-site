import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/flags/[key]/rollout/step/route";
import { FF, composeFFRuntime, resetFFRuntime } from "@/lib/ff/runtime";
import { InMemoryRuntimeLock } from "@/lib/ff/runtime/lock";
import { createInitialConfig, MemoryFlagStore } from "@/lib/ff/runtime/memory-store";
import type { SnapshotSummary } from "@/lib/ff/runtime/self-metrics";

class MockMetricsProvider {
  #summary: SnapshotSummary | null = null;

  setSummary(summary: SnapshotSummary | null) {
    this.#summary = summary;
  }

  recordVital() {}

  recordError() {}

  summarize(snapshotId?: string): SnapshotSummary[] {
    if (!this.#summary) return [];
    if (snapshotId && this.#summary.snapshotId !== snapshotId) return [];
    return [this.#summary];
  }

  hasData(snapshotId: string): boolean {
    return Boolean(this.#summary && this.#summary.snapshotId === snapshotId);
  }
}

function makeSummary(params: {
  snapshotId: string;
  sampleCount: number;
  errorRate: number;
  cls?: number;
  inp?: number;
}): SnapshotSummary {
  const metrics: SnapshotSummary["metrics"] = {};
  if (typeof params.cls === "number") {
    metrics.CLS = { p75: params.cls, samples: params.sampleCount };
  }
  if (typeof params.inp === "number") {
    metrics.INP = { p75: params.inp, samples: params.sampleCount };
  }
  return {
    snapshotId: params.snapshotId,
    metrics,
    errorRate: params.errorRate,
    errorCount: Math.round(params.errorRate * params.sampleCount),
    sampleCount: params.sampleCount,
  } satisfies SnapshotSummary;
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/flags/feature.newCheckout/rollout/step", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer ops-token",
    },
    body: JSON.stringify(body),
  });
}

describe("rollout step controller", () => {
  const originalEnv = { ...process.env } as Record<string, string | undefined>;
  if (!originalEnv.FF_CONSOLE_VIEWER_TOKENS) {
    originalEnv.FF_CONSOLE_VIEWER_TOKENS = "viewer-token";
  }
  let store: MemoryFlagStore;
  let metrics: MockMetricsProvider;
  let snapshotId: string;

  beforeEach(() => {
    resetFFRuntime();
    Object.assign(process.env, originalEnv);
    process.env.ADMIN_TOKEN_OPS = "ops-token";
    process.env.METRICS_PROVIDER = "self";
    store = new MemoryFlagStore();
    metrics = new MockMetricsProvider();
    const lock = new InMemoryRuntimeLock();
    composeFFRuntime({ store, lock, metrics });
    store.putFlag({
      ...createInitialConfig("feature.newCheckout"),
      namespace: "tenant:acme",
      rollout: { percent: 0, steps: [{ pct: 0, at: Date.now() - 60_000 }] },
    });
    snapshotId = FF().snapshot().id;
  });

  afterEach(() => {
    resetFFRuntime();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("returns HOLD when minimum samples not met", async () => {
    metrics.setSummary(
      makeSummary({ snapshotId, sampleCount: 100, errorRate: 0.002, cls: 0.05, inp: 120 }),
    );
    const res = await POST(
      makeRequest({ nextPct: 5, minSamples: 200, stop: { maxErrorRate: 0.01 } }),
      { params: { key: "feature.newCheckout" } },
    );
    expect(res.status).toBe(412);
    const json = await res.json();
    expect(json.reason).toBe("min_samples");
    expect(json.metrics.denominator).toBe(100);
  });

  it("blocks when metrics exceed thresholds beyond hysteresis", async () => {
    metrics.setSummary(
      makeSummary({ snapshotId, sampleCount: 400, errorRate: 0.02, cls: 0.06, inp: 220 }),
    );
    const res = await POST(
      makeRequest({
        nextPct: 5,
        stop: { maxErrorRate: 0.01 },
        hysteresis: { errorRate: 0.005 },
      }),
      { params: { key: "feature.newCheckout" } },
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.reason).toBe("maxErrorRate");
    expect(json.metrics.errorRate).toBeCloseTo(0.02, 6);
  });

  it("applies rollout when metrics are within hysteresis", async () => {
    metrics.setSummary(
      makeSummary({ snapshotId, sampleCount: 450, errorRate: 0.011, cls: 0.05, inp: 180 }),
    );
    const res = await POST(
      makeRequest({
        nextPct: 10,
        stop: { maxErrorRate: 0.01 },
        hysteresis: { errorRate: 0.005 },
      }),
      { params: { key: "feature.newCheckout" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.rollout?.currentPct).toBe(10);
    const updated = FF().store.getFlag("feature.newCheckout");
    expect(updated?.rollout?.percent).toBe(10);
  });

  it("enforces cooldown between rollout steps", async () => {
    const now = Date.now();
    store.putFlag({
      ...createInitialConfig("feature.newCheckout"),
      namespace: "tenant:acme",
      rollout: {
        percent: 5,
        steps: [
          { pct: 0, at: now - 60 * 60 * 1000 },
          { pct: 5, at: now - 5 * 60 * 1000 },
        ],
      },
      updatedAt: now - 5 * 60 * 1000,
    });
    snapshotId = FF().snapshot().id;
    metrics.setSummary(
      makeSummary({ snapshotId, sampleCount: 500, errorRate: 0.005, cls: 0.05, inp: 150 }),
    );
    const res = await POST(makeRequest({ nextPct: 10, coolDownMs: 15 * 60 * 1000 }), {
      params: { key: "feature.newCheckout" },
    });
    expect(res.status).toBe(412);
    const json = await res.json();
    expect(json.reason).toBe("cool_down");
    expect(json.retryInMs).toBeGreaterThan(0);
  });

  it("performs dry-run without persisting changes", async () => {
    metrics.setSummary(
      makeSummary({ snapshotId, sampleCount: 350, errorRate: 0.004, cls: 0.04, inp: 140 }),
    );
    const res = await POST(
      makeRequest({ nextPct: 5, dryRun: true, stop: { maxErrorRate: 0.01 } }),
      { params: { key: "feature.newCheckout" } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.decision).toBe("advance");
    expect(json.metrics.denominator).toBe(350);
    const current = FF().store.getFlag("feature.newCheckout");
    expect(current?.rollout?.percent).toBe(0);
  });
});
