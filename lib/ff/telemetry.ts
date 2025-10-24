// Telemetry sink for feature-flag evaluations (in-memory / console / none).
// Non-blocking: tracking must never throw.

export type TelemetrySource = "env" | "override" | "default" | "global";

export type TelemetryEvent = {
  ts: number; // timestamp (ms since epoch)
  flag: string; // flag name
  value: boolean | string | number; // effective value
  source: TelemetrySource; // where the value came from
  stableId: string; // stable identifier used for hashing
  userId?: string; // extracted from stableId if available
  evaluationTime?: number; // ms spent evaluating this flag
  cacheHit?: boolean; // reserved; currently always false
};

const RING: TelemetryEvent[] = [];

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function getSink(): "none" | "console" | "memory" {
  return (process.env.FF_TELEMETRY_SINK || "none").toLowerCase() as "none" | "console" | "memory";
}

function getRingLimit(): number {
  return clamp(Number(process.env.FF_TELEMETRY_RING ?? 1000), 10, 10000);
}

export function trackFlagEvaluation(e: TelemetryEvent): void {
  try {
    const sink = getSink();
    if (sink === "console") {
      // eslint-disable-next-line no-console
      console.log("[flag]", e);
    } else if (sink === "memory") {
      const limit = getRingLimit();
      while (RING.length >= limit) RING.shift();
      RING.push(e);
    }
  } catch {
    // never throw
  }
}

export function readRecent(limit = 200, filter?: { flag?: string }): TelemetryEvent[] {
  const cap = getRingLimit();
  const n = clamp(limit, 1, cap);
  const slice = RING.slice(-n);
  if (filter?.flag) {
    const name = filter.flag;
    return slice.filter((e) => e.flag === name);
  }
  return slice;
}

// tests-only
export function __clearTelemetry() {
  RING.length = 0;
}
