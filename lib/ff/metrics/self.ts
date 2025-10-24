import fs from "node:fs";
import path from "node:path";

import type { MetricsProvider, Namespace } from "../core/ports";

type MetricRecord = {
  ts?: number;
  snap?: string;
  name?: string;
  value?: number;
  type?: string;
};

function snapHasFlagOn(snap: string, ns: string, flag: string) {
  return snap.split(";").includes(`${ns}:${flag}=on`);
}

function p75(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.floor(0.75 * (sorted.length - 1));
  return sorted[idx] ?? null;
}

function readWindow(file: string, windowMs: number): MetricRecord[] {
  const now = Date.now();
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return [];
    return raw
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line) as MetricRecord;
        } catch {
          return null;
        }
      })
      .filter((rec): rec is MetricRecord => Boolean(rec) && now - Number(rec.ts ?? 0) <= windowMs);
  } catch {
    return [];
  }
}

export function SelfHostedMetricsProvider(opts?: {
  vitalsFile?: string;
  errorsFile?: string;
}): MetricsProvider {
  const vitalsFile = opts?.vitalsFile ?? path.resolve("./.runtime/vitals.ndjson");
  const errorsFile = opts?.errorsFile ?? path.resolve("./.runtime/errors.ndjson");

  return {
    async getErrorRate(flagKey: string, ns: Namespace, windowMs: number) {
      const vitals = readWindow(vitalsFile, windowMs);
      const errors = readWindow(errorsFile, windowMs);
      const denom = vitals.filter((v) => snapHasFlagOn(v.snap || "", ns, flagKey)).length;
      const num = errors.filter((e) => snapHasFlagOn(e.snap || "", ns, flagKey)).length;
      if (denom === 0) return null;
      return num / denom;
    },

    async getWebVital(metric, flagKey: string, ns: Namespace, windowMs: number) {
      const vitals = readWindow(vitalsFile, windowMs)
        .filter((v) => v.name === metric && snapHasFlagOn(v.snap || "", ns, flagKey))
        .map((v) => Number(v.value))
        .filter((v) => Number.isFinite(v));
      const val = p75(vitals);
      if (val === null) return null;
      return metric === "INP" ? Math.round(val) : Number(val.toFixed(3));
    },
  };
}
