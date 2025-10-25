import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __clearTelemetry, readRecent, trackFlagEvaluation } from "../../lib/ff/telemetry";

describe("telemetry ring buffer", () => {
  beforeEach(() => {
    process.env.FF_TELEMETRY_SINK = "memory";
    __clearTelemetry();
  });

  afterEach(() => {
    delete process.env.FF_TELEMETRY_SINK;
    delete process.env.FF_TELEMETRY_RING;
    __clearTelemetry();
  });

  it("stores events and returns recent items", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      trackFlagEvaluation({
        ts: now + i,
        flag: "f",
        value: i % 2 === 0,
        source: "env",
        stableId: "sv_x",
        evaluationTime: 1,
        type: "evaluation",
        requestId: null,
        sessionId: null,
        namespace: "default",
      });
    }
    const recent = readRecent(3);
    expect(recent.length).toBe(3);
    expect(recent[0].ts).toBe(now + 2);
    expect(recent[2].ts).toBe(now + 4);
  });

  it("filters by flag", () => {
    const now = Date.now();
    trackFlagEvaluation({
      ts: now,
      flag: "a",
      value: true,
      source: "env",
      stableId: "sv",
      type: "evaluation",
      requestId: null,
      sessionId: null,
      namespace: "default",
    });
    trackFlagEvaluation({
      ts: now + 1,
      flag: "b",
      value: false,
      source: "override",
      stableId: "sv",
      type: "evaluation",
      requestId: null,
      sessionId: null,
      namespace: "default",
    });
    const onlyA = readRecent(10, { flag: "a" });
    expect(onlyA.length).toBe(1);
    expect(onlyA[0].flag).toBe("a");
  });
});
