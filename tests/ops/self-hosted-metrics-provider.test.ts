import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelfHostedMetricsProvider } from "@/lib/ops/self-hosted-metrics-provider";
import { appendErasure } from "@/lib/privacy/erasure";

const BASE_TIME = new Date("2024-01-01T00:00:00.000Z");

describe("SelfHostedMetricsProvider", () => {
  let tmpDir: string;
  let vitalsFile: string;
  let errorsFile: string;
  const originalErasureFile = process.env.PRIVACY_ERASURE_FILE;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sv-metrics-"));
    vitalsFile = path.join(tmpDir, "vitals.ndjson");
    errorsFile = path.join(tmpDir, "errors.ndjson");
    process.env.PRIVACY_ERASURE_FILE = path.join(tmpDir, "privacy.erasure.ndjson");
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (originalErasureFile) {
      process.env.PRIVACY_ERASURE_FILE = originalErasureFile;
    } else {
      delete process.env.PRIVACY_ERASURE_FILE;
    }
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

  it("returns null error rate when there are errors but no samples", async () => {
    const snapshotId = "snapshot-errors-only";
    const now = Date.now();
    const errors = [
      { snapshotId, ts: now - 1_000 },
      { snapshotId, ts: now - 500 },
    ];
    await writeFile(
      errorsFile,
      `${errors.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    const provider = new SelfHostedMetricsProvider({
      windowMs: 10 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    const rate = await provider.getErrorRate("flag-errors", snapshotId);
    expect(rate).toBeNull();
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

  it("filters erased identifiers from vitals and errors", async () => {
    const snapshotId = "snapshot-erasure";
    const now = Date.now();
    await appendErasure({ sid: "session-remove", aid: "aid-remove" }, "system");

    const vitals = [
      { snapshotId, metric: "INP", value: 90, ts: now - 3_000, sid: "session-keep" },
      { snapshotId, metric: "INP", value: 510, ts: now - 2_000, sid: "session-remove" },
      { snapshotId, metric: "CLS", value: 0.12, ts: now - 1_500, aid: "aid-remove" },
    ];
    const errors = [
      { snapshotId, ts: now - 2_500, sid: "session-remove" },
      { snapshotId, ts: now - 1_000, sid: "session-keep" },
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

    const p75 = await provider.getWebVital("INP", "flag-E", snapshotId);
    const rate = await provider.getErrorRate("flag-E", snapshotId);
    expect(p75).toBe(90);
    expect(rate).toBeCloseTo(1 / 1, 5);
  });

  it("streams large vitals files without exhausting memory", async () => {
    const snapshotId = "snapshot-large";
    const now = Date.now();
    const entries: string[] = [];
    for (let i = 0; i < 5000; i += 1) {
      entries.push(JSON.stringify({ snapshotId, metric: "INP", value: i, ts: now - (i % 1000) }));
    }
    await writeFile(vitalsFile, `${entries.join("\n")}\n`, "utf8");

    const provider = new SelfHostedMetricsProvider({
      windowMs: 15 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    await expect(provider.getWebVital("INP", "flag-large", snapshotId)).resolves.toBe(3749);
  });

  it("reuses cached windows within the TTL", async () => {
    const snapshotId = "snapshot-cache";
    const now = Date.now();
    const firstVitals = [{ snapshotId, metric: "INP", value: 120, ts: now - 4_000 }];
    await writeFile(
      vitalsFile,
      `${firstVitals.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    const provider = new SelfHostedMetricsProvider({
      windowMs: 10 * 60 * 1000,
      vitalsFile,
      errorsFile,
    });

    await expect(provider.getWebVital("INP", "flag-cache", snapshotId)).resolves.toBe(120);

    const updatedVitals = [
      ...firstVitals,
      { snapshotId, metric: "INP", value: 480, ts: now - 3_000 },
    ];
    await writeFile(
      vitalsFile,
      `${updatedVitals.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    vi.advanceTimersByTime(29_000);
    await expect(provider.getWebVital("INP", "flag-cache", snapshotId)).resolves.toBe(120);

    vi.advanceTimersByTime(2_000);
    await expect(provider.getWebVital("INP", "flag-cache", snapshotId)).resolves.toBe(480);
  });
});
