import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelfHostedMetricsProvider } from "@/lib/ops/self-hosted-metrics-provider";

const BASE_TIME = new Date("2024-01-01T00:00:00.000Z");

describe("SelfHostedMetricsProvider", () => {
  let tmpDir: string;
  let vitalsFile: string;
  let errorsFile: string;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sv-metrics-"));
    vitalsFile = path.join(tmpDir, "vitals.ndjson");
    errorsFile = path.join(tmpDir, "errors.ndjson");
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("computes p75 for INP samples within the window", async () => {
    const snapshotId = "snapshot-a";
    const now = Date.now();
    const lines = [
      { snapshotId, metric: "INP", value: 120, ts: now - 10_000 },
      { snapshotId, metric: "INP", value: 450, ts: now - 5_000 },
      { snapshotId, metric: "INP", value: 210, ts: now - 2_000 },
      { snapshotId, metric: "CLS", value: 0.09, ts: now - 1_000 },
    ];
    await writeFile(
      vitalsFile,
      lines.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );
    await writeFile(errorsFile, "", "utf8");

    const provider = new SelfHostedMetricsProvider({
      windowMs: 15 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    const result = await provider.getWebVital("INP", "flag-A", snapshotId);
    expect(result).toBe(450);
  });

  it("computes error rate using snapshot totals", async () => {
    const snapshotId = "snapshot-b";
    const now = Date.now();
    const vitals = [
      { snapshotId, metric: "INP", value: 150, ts: now - 4_000 },
      { snapshotId, metric: "INP", value: 175, ts: now - 3_500 },
      { snapshotId, metric: "CLS", value: 0.05, ts: now - 3_000 },
    ];
    const errors = [
      { snapshotId, ts: now - 3_000 },
      { snapshotId, ts: now - 1_000 },
    ];
    await writeFile(
      vitalsFile,
      vitals.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );
    await writeFile(
      errorsFile,
      errors.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );

    const provider = new SelfHostedMetricsProvider({
      windowMs: 10 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    const rate = await provider.getErrorRate("flag-B", snapshotId);
    expect(rate).toBeCloseTo(2 / 3, 5);
  });

  it("returns null when there are no events in the window", async () => {
    const snapshotId = "snapshot-empty";
    const past = Date.now() - 60 * 60 * 1000;
    const vitals = [{ snapshotId, metric: "INP", value: 200, ts: past }];
    await writeFile(
      vitalsFile,
      vitals.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );

    const provider = new SelfHostedMetricsProvider({
      windowMs: 5 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    const result = await provider.getWebVital("INP", "flag-C", snapshotId);
    const rate = await provider.getErrorRate("flag-C", snapshotId);
    expect(result).toBeNull();
    expect(rate).toBeNull();
  });

  it("ignores vitals entries with missing fields", async () => {
    const snapshotId = "snapshot-mixed";
    const now = Date.now();
    const vitals = [
      {},
      { snapshotId, metric: "INP", value: 320, ts: now - 4_000 },
      { snapshotId, metric: "INP", value: "invalid", ts: now - 3_000 },
      { snapshotId, metric: "INP", value: 410 },
      { snapshotId, metric: "CLS", value: 0.05, ts: now - 2_000 },
    ];
    await writeFile(
      vitalsFile,
      vitals.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );

    const provider = new SelfHostedMetricsProvider({
      windowMs: 10 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    await expect(provider.getWebVital("INP", "flag-D", snapshotId)).resolves.toBe(320);
  });
});
