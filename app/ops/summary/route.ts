import "server-only";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const { store, metrics } = FF();
  const snapshot = await store.snapshot();
  const metricsProvider = (process.env.METRICS_PROVIDER || "self").toLowerCase();
  const namespaces = new Set(snapshot.flags.map((flag) => flag.namespace || "default"));
  const summary = {
    flags: snapshot.flags.length,
    overrides: snapshot.overrides.length,
    namespaces: namespaces.size,
    metricsProvider,
    killAll: process.env.FF_KILL_ALL === "true",
    freezeOverrides: process.env.FF_FREEZE_OVERRIDES === "true",
    snapshots: metrics.summarize().length,
  };
  return auth.apply(NextResponse.json(summary));
}
