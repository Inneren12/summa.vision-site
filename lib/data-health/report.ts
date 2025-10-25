import { promises as fs } from "node:fs";
import path from "node:path";

export type DataHealthSummary = {
  ok: boolean;
  freshness: unknown;
  ge: unknown;
  frictionless: unknown;
  duckdb: unknown;
  license: unknown;
  ts: unknown;
  msg?: string;
};

const REPORT_PATH = path.join(process.cwd(), "reports", "data-validation.json");

type ErrnoException = NodeJS.ErrnoException & { code?: string };

function emptySummary(message: string): DataHealthSummary {
  return {
    ok: false,
    msg: message,
    freshness: null,
    ge: null,
    frictionless: null,
    duckdb: null,
    license: null,
    ts: null,
  };
}

function normalizeSummary(candidate: unknown): DataHealthSummary {
  if (!candidate || typeof candidate !== "object") {
    return emptySummary("invalid report");
  }
  const report = candidate as Record<string, unknown>;
  const summary: DataHealthSummary = {
    ok: Boolean(report.ok),
    freshness: report.freshness ?? null,
    ge: report.ge ?? null,
    frictionless: report.frictionless ?? null,
    duckdb: report.duckdb ?? null,
    license: report.license ?? null,
    ts: report.ts ?? null,
  };
  if (typeof report.msg === "string" && report.msg.trim() !== "") {
    summary.msg = report.msg;
  }
  return summary;
}

export async function readDataHealthSummary(): Promise<DataHealthSummary> {
  try {
    const raw = await fs.readFile(REPORT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeSummary(parsed);
  } catch (error) {
    const err = error as ErrnoException;
    if (err?.code === "ENOENT") {
      return emptySummary("no report");
    }
    if (error instanceof SyntaxError) {
      return emptySummary("invalid report");
    }
    return emptySummary("failed to read report");
  }
}
