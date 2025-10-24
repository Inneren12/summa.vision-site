import { afterEach, describe, it, expect } from "vitest";

import { withExposureContext, trackExposure } from "@/lib/ff/exposure";
import { composeFFRuntime, resetFFRuntime } from "@/lib/ff/runtime";
import type { TelemetryEvent } from "@/lib/ff/telemetry";

afterEach(() => {
  resetFFRuntime();
});

describe("ALS exposure dedup", () => {
  it("logs once per SSR request for same flag/value", () => {
    const events: TelemetryEvent[] = [];
    composeFFRuntime({ telemetry: { emit: (e: TelemetryEvent) => events.push(e) } });
    withExposureContext(() => {
      trackExposure({ flag: "betaUI", value: true, source: "env", stableId: "u:1" });
      trackExposure({ flag: "betaUI", value: true, source: "env", stableId: "u:1" });
    });
    expect(events.filter((e) => e.type === "exposure").length).toBe(1);
  });
});
