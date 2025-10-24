import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SelfMetricsProvider } from "@/lib/ff/runtime/self-metrics";

function waitForQueue() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("SelfMetricsProvider persistence", () => {
  let tmpDir: string;
  let vitalsFile: string;
  let errorsFile: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sv-self-metrics-"));
    vitalsFile = path.join(tmpDir, "vitals.ndjson");
    errorsFile = path.join(tmpDir, "errors.ndjson");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates vitals and errors files with ndjson entries", async () => {
    const provider = new SelfMetricsProvider(60_000, vitalsFile, errorsFile);
    provider.recordVital("snapshot-test", "INP", 245, {
      id: "metric-test",
      label: "web-vital",
    });
    provider.recordError("snapshot-test", "Boom", undefined);

    await waitForQueue();

    const vitalsContent = await readFile(vitalsFile, "utf8");
    const vitalsLines = vitalsContent.trim().split(/\r?\n/);
    expect(vitalsLines).toHaveLength(1);
    const vitalEvent = JSON.parse(vitalsLines[0]) as Record<string, unknown>;
    expect(vitalEvent.snapshotId).toBe("snapshot-test");
    expect(vitalEvent.metric).toBe("INP");
    expect(vitalEvent.value).toBe(245);
    expect(vitalEvent.label).toBe("web-vital");
    expect(vitalEvent.id).toBe("metric-test");

    const errorsContent = await readFile(errorsFile, "utf8");
    const errorLines = errorsContent.trim().split(/\r?\n/);
    expect(errorLines).toHaveLength(1);
    const errorEvent = JSON.parse(errorLines[0]) as Record<string, unknown>;
    expect(errorEvent.snapshotId).toBe("snapshot-test");
    expect(errorEvent.message).toBe("Boom");
  });
});
