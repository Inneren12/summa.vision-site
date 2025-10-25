import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { rotateFile, shouldRotate } from "@/scripts/metrics-rotate.mjs";

describe("metrics-rotate script", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("rotates files that exceed the size threshold", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "metrics-rotate-"));
    const filePath = path.join(tempDir, "vitals.ndjson");
    const payload = `${JSON.stringify({ snapshotId: "a", metric: "CLS", value: 0.1 })}\n`;
    await writeFile(filePath, payload.repeat(10), "utf8");

    const now = Date.now();
    const result = await rotateFile(filePath, { maxBytes: 100, maxAgeMs: 0, now });

    expect(result.rotated).toBe(true);
    expect(result.chunk).toBeDefined();
    const files = await readdir(tempDir);
    expect(files).toContain("vitals.ndjson");
    expect(files.some((name) => /^vitals-\d{8}(?:-\d+)?\.ndjson$/.test(name))).toBe(true);
    const activeContent = await readFile(filePath, "utf8");
    expect(activeContent).toBe("");
  });

  it("skips rotation when thresholds are not reached", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "metrics-rotate-"));
    const filePath = path.join(tempDir, "telemetry.ndjson");
    await writeFile(filePath, "{}\n", "utf8");

    const stats = await (async () => {
      const result = await rotateFile(filePath, {
        maxBytes: 1024,
        maxAgeMs: DAY_MS,
        now: Date.now(),
      });
      return result;
    })();

    expect(stats.rotated).toBe(false);
    expect(stats.reason).toBe("threshold");

    const fakeStats = { size: 0, mtimeMs: Date.now() } satisfies { size: number; mtimeMs: number };
    expect(shouldRotate(fakeStats, Date.now(), { maxBytes: 10, maxAgeMs: 0 })).toBe(false);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
