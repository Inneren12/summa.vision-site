import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelfHostedMetricsProvider } from "@/lib/ops/self-hosted-metrics-provider";
import {
  __clearErasureCacheForTests,
  appendErasure,
  purgeNdjsonFiles,
} from "@/lib/privacy/erasure";

describe("privacy erasure registry", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let erasureFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "erasure-test-"));
    erasureFile = path.join(tempDir, "privacy.erasure.ndjson");
    process.env.PRIVACY_ERASURE_FILE = erasureFile;
    __clearErasureCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(async () => {
    __clearErasureCacheForTests();
    if (originalEnv.PRIVACY_ERASURE_FILE) {
      process.env.PRIVACY_ERASURE_FILE = originalEnv.PRIVACY_ERASURE_FILE;
    } else {
      delete process.env.PRIVACY_ERASURE_FILE;
    }
    vi.useRealTimers();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("filters metrics for erased identifiers", async () => {
    const vitalsFile = path.join(tempDir, "vitals.ndjson");
    const errorsFile = path.join(tempDir, "errors.ndjson");
    const now = Date.now();
    const lines = [
      { snapshotId: "flag/ns", metric: "CLS", value: 0.12, ts: now, sid: "sid-keep" },
      { snapshotId: "flag/ns", metric: "CLS", value: 0.34, ts: now, sid: "sid-erase" },
    ];
    const errorEvents = [{ snapshotId: "flag/ns", ts: now, sid: "sid-erase" }];
    await fs.writeFile(
      vitalsFile,
      lines.map((line) => `${JSON.stringify(line)}\n`).join(""),
      "utf8",
    );
    await fs.writeFile(
      errorsFile,
      errorEvents.map((line) => `${JSON.stringify(line)}\n`).join(""),
      "utf8",
    );

    await appendErasure({ sid: "sid-erase" }, "self");

    const provider = new SelfHostedMetricsProvider({ vitalsFile, errorsFile });
    const vital = await provider.getWebVital("CLS", "flag", "flag/ns");
    expect(vital).toBeCloseTo(0.12);

    const errorRate = await provider.getErrorRate("flag", "flag/ns");
    expect(errorRate).toBe(0);
  });

  it("purges small ndjson files eagerly", async () => {
    const telemetryFile = path.join(tempDir, "telemetry.ndjson");
    const keep = { stableId: "sid-keep", ts: Date.now(), type: "evaluation" };
    const remove = { stableId: "sid-erase", ts: Date.now(), type: "evaluation" };
    await fs.writeFile(
      telemetryFile,
      `${JSON.stringify(keep)}\n${JSON.stringify(remove)}\n`,
      "utf8",
    );

    const report = await purgeNdjsonFiles([telemetryFile], { sid: "sid-erase" });
    const contents = await fs.readFile(telemetryFile, "utf8");
    const lines = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(report[0]).toMatchObject({
      removed: 1,
      skipped: false,
      file: path.resolve(telemetryFile),
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].stableId).toBe("sid-keep");
  });
});
