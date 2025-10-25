import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { FF } from "@/lib/ff/runtime";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";

export const runtime = "nodejs";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";
const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";
const DEFAULT_ROTATE_MB = 50;
const DEFAULT_ROTATE_DAYS = 7;

type NdjsonSummary = {
  path: string;
  sizeBytes: number;
  modifiedAt: string | null;
  chunks: number;
};

function parseRotateNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function describeNdjson(basePath: string): Promise<NdjsonSummary> {
  const resolved = path.resolve(basePath);
  let sizeBytes = 0;
  let modifiedAt: string | null = null;
  try {
    const stats = await fs.stat(resolved);
    if (stats.isFile()) {
      sizeBytes = stats.size;
      modifiedAt = new Date(stats.mtimeMs).toISOString();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  let chunks = 0;
  try {
    const files = await listNdjsonFiles(basePath, { maxChunkCount: 0, maxChunkDays: 0 });
    const resolvedBase = path.resolve(basePath);
    chunks = files.filter((file) => path.resolve(file) !== resolvedBase).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return { path: resolved, sizeBytes, modifiedAt, chunks } satisfies NdjsonSummary;
}

export async function GET(req: Request) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const { store, metrics } = FF();
  const snapshot = await store.snapshot();
  const metricsProvider = (process.env.METRICS_PROVIDER || "self").toLowerCase();
  const namespaces = new Set(snapshot.flags.map((flag) => flag.namespace || "default"));
  const telemetryFile = process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  const vitalsFile = process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE;
  const errorsFile = process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE;
  const [telemetrySummary, vitalsSummary, errorsSummary] = await Promise.all([
    describeNdjson(telemetryFile),
    describeNdjson(vitalsFile),
    describeNdjson(errorsFile),
  ]);
  const rotateMaxMb = parseRotateNumber(process.env.METRICS_ROTATE_MAX_MB, DEFAULT_ROTATE_MB);
  const rotateDays = parseRotateNumber(process.env.METRICS_ROTATE_DAYS, DEFAULT_ROTATE_DAYS);
  const summary = {
    flags: snapshot.flags.length,
    overrides: snapshot.overrides.length,
    namespaces: namespaces.size,
    metricsProvider,
    killAll: process.env.FF_KILL_ALL === "true",
    freezeOverrides: process.env.FF_FREEZE_OVERRIDES === "true",
    snapshots: metrics.summarize().length,
    ndjson: {
      telemetry: telemetrySummary,
      vitals: vitalsSummary,
      errors: errorsSummary,
    },
    rotation: {
      maxMb: rotateMaxMb,
      days: rotateDays,
    },
    privacy: {
      consentDefault: "necessary" as const,
      consentOverrides: {
        header: true,
        cookie: true,
      },
      doNotTrack: {
        honored: true,
        headers: ["dnt", "x-do-not-track", "sec-gpc"],
      },
    },
  };
  return auth.apply(NextResponse.json(summary));
}
