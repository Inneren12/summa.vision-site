import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/ops/summary/route";
import { __resetEnvCache } from "@/lib/env/load";
import * as runtime from "@/lib/ff/runtime";

const TEST_URL = "https://example.com/ops/summary";

describe("/ops/summary", () => {
  const savedEnv = { ...process.env };
  let tempDir: string;
  let ffSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(async () => {
    Object.assign(process.env, savedEnv);
    process.env.FF_CONSOLE_OPS_TOKENS = "ops-token";
    process.env.ADMIN_RATE_LIMIT_TELEMETRY_EXPORT_RPM = "0";
    process.env.METRICS_ROTATE_MAX_MB = "64";
    process.env.METRICS_ROTATE_DAYS = "10";
    process.env.METRICS_WINDOW_MS = "600000";
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ops-summary-"));
    process.env.TELEMETRY_FILE = path.join(tempDir, "telemetry.ndjson");
    process.env.METRICS_VITALS_FILE = path.join(tempDir, "vitals.ndjson");
    process.env.METRICS_ERRORS_FILE = path.join(tempDir, "errors.ndjson");

    await fs.writeFile(
      process.env.TELEMETRY_FILE!,
      [
        JSON.stringify({ ts: 1719427200000, type: "evaluation", flag: "alpha" }),
        JSON.stringify({ ts: 1719428200000, type: "evaluation", flag: "beta" }),
      ].join("\n") + "\n",
      "utf8",
    );
    await fs.writeFile(
      process.env.METRICS_VITALS_FILE!,
      [
        JSON.stringify({ ts: 1719427200000, metric: "lcp", value: 2500 }),
        JSON.stringify({ ts: 1719428200000, metric: "inp", value: 200 }),
      ].join("\n") + "\n",
      "utf8",
    );
    await fs.writeFile(
      process.env.METRICS_ERRORS_FILE!,
      [JSON.stringify({ ts: 1719427200000, message: "boom" })].join("\n") + "\n",
      "utf8",
    );

    const store = {
      snapshot: vi.fn().mockResolvedValue({
        flags: [
          { key: "flag-alpha", namespace: "checkout" },
          { key: "flag-beta", namespace: "" },
        ],
        overrides: [
          {
            flag: "flag-alpha",
            scope: { type: "user", id: "u1" },
            value: true,
            updatedAt: Date.now(),
          },
        ],
      }),
    };

    const metrics = {
      summarize: vi
        .fn()
        .mockReturnValue([
          { snapshotId: "abc", metrics: {}, errorRate: 0, errorCount: 0, sampleCount: 0 },
        ]),
    };

    ffSpy = vi.spyOn(runtime, "FF").mockReturnValue({
      store: store as unknown as ReturnType<typeof runtime.FF>["store"],
      metrics: metrics as unknown as ReturnType<typeof runtime.FF>["metrics"],
      telemetrySink: { emit: vi.fn() },
      lock: {} as ReturnType<typeof runtime.FF>["lock"],
      snapshot: vi.fn(),
    } as unknown as ReturnType<typeof runtime.FF>);

    __resetEnvCache();
  });

  afterEach(async () => {
    ffSpy?.mockRestore();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
    __resetEnvCache();
  });

  it("returns metrics and storage summary", async () => {
    const res = await GET(
      new Request(TEST_URL, {
        headers: { authorization: "Bearer ops-token" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.flags).toBe(2);
    expect(body.overrides).toBe(1);
    expect(body.namespaces).toBe(2);
    expect(body.metricsProvider).toBe((process.env.METRICS_PROVIDER || "self").toLowerCase());
    expect(body.metricsWindowMs).toBe(600000);
    expect(body.snapshots).toBe(1);

    expect(body.ndjson.telemetry.records).toBe(2);
    expect(body.ndjson.vitals.records).toBe(2);
    expect(body.ndjson.errors.records).toBe(1);
    expect(body.rotation).toEqual({ maxMb: 64, days: 10 });
    expect(body.privacy.consentDefault).toBe("necessary");
    expect(body.privacy.doNotTrackHeaders).toEqual(["dnt", "x-do-not-track", "sec-gpc"]);
  });
});
