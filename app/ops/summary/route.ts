import "server-only";

import { NextResponse } from "next/server";

import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

export async function GET() {
  const { store, metrics } = FF();
  const snapshot = store.snapshot();
  const summary = {
    flags: snapshot.flags.length,
    overrides: snapshot.overrides.length,
    metricsProvider: (process.env.METRICS_PROVIDER || "self").toLowerCase(),
    killAll: process.env.FF_KILL_ALL === "true",
    freezeOverrides: process.env.FF_FREEZE_OVERRIDES === "true",
    snapshots: metrics.summarize().length,
  };
  return NextResponse.json(summary);
}
