import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

const StepSchema = z.object({
  step: z.number().min(-100).max(100).default(5),
});

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const json = await req.json().catch(() => ({}));
  const parsed = StepSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { step } = parsed.data;
  const key = params.key;
  const { store, lock, metrics } = FF();
  const existing = store.getFlag(key);
  if (!existing) {
    return NextResponse.json({ error: `Flag ${key} not found` }, { status: 404 });
  }
  const snapshot = FF().snapshot();
  const requiresMetrics = (process.env.METRICS_PROVIDER || "self").toLowerCase() === "self";
  if (requiresMetrics && !metrics.hasData(snapshot.id)) {
    return NextResponse.json({ error: "Insufficient metrics" }, { status: 412 });
  }
  const updated = await lock.withLock(key, async () => {
    const current = store.getFlag(key);
    if (!current) throw new Error("Flag disappeared");
    const base = current.rollout?.percent ?? 0;
    const nextPercent = Math.max(0, Math.min(100, base + step));
    const nextConfig = {
      ...current,
      rollout: { ...(current.rollout ?? { percent: 0 }), percent: nextPercent },
    };
    return store.putFlag(nextConfig);
  });
  return NextResponse.json({ ok: true, rollout: updated.rollout });
}
