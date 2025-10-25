import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { preflightRollout } from "@/scripts/ff-rollout.mjs";

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

describe("ff-rollout preflight", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("returns rollout summary for valid policy", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ff-preflight-"));
    const policyPath = path.join(tempDir, "policy.json");
    const allowlistPath = path.join(tempDir, "allowlist.json");

    await writeJson(policyPath, {
      host: "https://flags.internal",
      flag: "demo-rollout",
      steps: [0, 10, 25],
      stop: { maxErrorRate: 0.05 },
      hysteresis: { errorRate: 0.02 },
      canary: {
        ttlHours: 24,
        cohort: [{ userId: "ops-reviewer" }, { ff_aid: "aid-ops" }],
      },
    });

    await writeJson(allowlistPath, {
      userIds: ["ops-reviewer", "ops-admin"],
      ffAids: ["aid-ops"],
    });

    const summary = await preflightRollout(policyPath, { allowlistPath });

    expect(summary.flag).toBe("demo-rollout");
    expect(summary.steps).toEqual([
      { index: 1, pct: 0, delta: 0 },
      { index: 2, pct: 10, delta: 10 },
      { index: 3, pct: 25, delta: 15 },
    ]);
    expect(summary.stop).toEqual({ maxErrorRate: 0.05 });
    expect(summary.hysteresis).toEqual({ errorRate: 0.02 });
    expect(summary.canary).toMatchObject({
      ttlHours: 24,
      size: 2,
      allowlistPath,
    });
  });

  it("rejects invalid policies", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ff-preflight-"));
    const policyPath = path.join(tempDir, "policy.json");
    const allowlistPath = path.join(tempDir, "allowlist.json");

    await writeJson(policyPath, {
      flag: "invalid-steps",
      steps: [0, 10, 10],
    });
    await writeJson(allowlistPath, { userIds: [], ffAids: [] });

    await expect(preflightRollout(policyPath, { allowlistPath })).rejects.toThrow(
      /Policy validation failed/i,
    );
  });

  it("rejects canary identifiers outside allowlist", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ff-preflight-"));
    const policyPath = path.join(tempDir, "policy.json");
    const allowlistPath = path.join(tempDir, "allowlist.json");

    await writeJson(policyPath, {
      flag: "rollout",
      steps: [0, 20],
      canary: {
        ttlHours: 12,
        cohort: [{ userId: "ops-missing" }],
      },
    });
    await writeJson(allowlistPath, { userIds: ["ops-existing"], ffAids: [] });

    await expect(preflightRollout(policyPath, { allowlistPath })).rejects.toThrow(/ops-missing/);
  });
});
