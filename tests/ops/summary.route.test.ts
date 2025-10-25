import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/ops/summary/route";
import { FF, resetFFRuntime } from "@/lib/ff/runtime";

const TEST_URL = "https://example.com/ops/summary";

describe("/ops/summary", () => {
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = { ...process.env } as Record<string, string | undefined>;
    process.env.FF_CONSOLE_OPS_TOKENS = "ops-token";
    resetFFRuntime();
  });

  afterEach(async () => {
    resetFFRuntime();
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("reports NDJSON status, rotation, and privacy metadata", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ops-summary-"));
    try {
      const telemetryFile = path.join(tmpDir, "telemetry.ndjson");
      const vitalsFile = path.join(tmpDir, "vitals.ndjson");
      const errorsFile = path.join(tmpDir, "errors.ndjson");
      process.env.TELEMETRY_FILE = telemetryFile;
      process.env.METRICS_VITALS_FILE = vitalsFile;
      process.env.METRICS_ERRORS_FILE = errorsFile;
      process.env.METRICS_ROTATE_MAX_MB = "12";
      process.env.METRICS_ROTATE_DAYS = "3";
      resetFFRuntime();

      await fs.writeFile(telemetryFile, `${JSON.stringify({ ts: 1 })}\n`, "utf8");
      await fs.writeFile(vitalsFile, `${JSON.stringify({ ts: 2 })}\n`, "utf8");
      await fs.writeFile(errorsFile, `${JSON.stringify({ ts: 3 })}\n`, "utf8");
      await fs.writeFile(
        path.join(tmpDir, "vitals-20240101.ndjson"),
        `${JSON.stringify({ ts: 4 })}\n`,
        "utf8",
      );

      const { store } = FF();
      await store.putFlag({
        key: "beta",
        namespace: "summa",
        version: 1,
        description: "beta flag",
        enabled: true,
        kill: false,
        killSwitch: false,
        seedByDefault: "stableId",
        defaultValue: false,
        tags: ["ops"],
        rollout: { percent: 50, seedBy: "stableId" },
        segments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await store.putOverride({
        flag: "beta",
        scope: { type: "global" },
        value: true,
        updatedAt: Date.now(),
      });

      const res = await GET(
        new Request(TEST_URL, {
          headers: { authorization: "Bearer ops-token" },
        }),
      );
      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(payload.flags).toBe(1);
      expect(payload.overrides).toBe(1);
      expect(payload.ndjson.telemetry.path).toContain(path.basename(telemetryFile));
      expect(payload.ndjson.telemetry.sizeBytes).toBeGreaterThan(0);
      expect(payload.ndjson.vitals.chunks).toBeGreaterThanOrEqual(1);
      expect(payload.rotation.maxMb).toBe(12);
      expect(payload.rotation.days).toBe(3);
      expect(payload.privacy.consentDefault).toBe("necessary");
      expect(payload.privacy.doNotTrack.honored).toBe(true);
      expect(payload.metricsProvider).toBe("self");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
