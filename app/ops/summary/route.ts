import "server-only";

import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { getEnv } from "@/lib/env/load";
import { FF } from "@/lib/ff/runtime";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";

type NdjsonSummary = { files: number; records: number; bytes: number };

async function summarizeNdjson(basePath: string | undefined): Promise<NdjsonSummary> {
  if (!basePath) return { files: 0, records: 0, bytes: 0 } satisfies NdjsonSummary;
  const files = await listNdjsonFiles(basePath, { maxChunkCount: 0, maxChunkDays: 0 });
  const unique = Array.from(new Set(files));
  let records = 0;
  let bytes = 0;
  for (const file of unique) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
    bytes += Buffer.byteLength(content, "utf8");
    records += content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }
  return { files: unique.length, records, bytes } satisfies NdjsonSummary;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const env = getEnv();
  const { store, metrics } = FF();
  const snapshot = await store.snapshot();
  const metricsProvider = (process.env.METRICS_PROVIDER || "self").toLowerCase();
  const namespaces = new Set(snapshot.flags.map((flag) => flag.namespace || "default"));
  const [telemetryNdjson, vitalsNdjson, errorsNdjson] = await Promise.all([
    summarizeNdjson(process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE),
    summarizeNdjson(process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE),
    summarizeNdjson(process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE),
  ]);
  const summary = {
    flags: snapshot.flags.length,
    overrides: snapshot.overrides.length,
    namespaces: namespaces.size,
    metricsProvider,
    metricsWindowMs: env.METRICS_WINDOW_MS,
    killAll: process.env.FF_KILL_ALL === "true",
    freezeOverrides: process.env.FF_FREEZE_OVERRIDES === "true",
    snapshots: metrics.summarize().length,
    ndjson: {
      telemetry: telemetryNdjson,
      vitals: vitalsNdjson,
      errors: errorsNdjson,
    },
    rotation: {
      maxMb: env.METRICS_ROTATE_MAX_MB,
      days: env.METRICS_ROTATE_DAYS,
    },
    privacy: {
      consentDefault: "necessary" as const,
      consentHeader: "x-consent",
      consentCookie: "sv_consent",
      doNotTrackHeaders: ["dnt", "x-do-not-track", "sec-gpc"],
    },
  };
  return auth.apply(NextResponse.json(summary));
}
