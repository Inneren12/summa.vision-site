import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { compactTarget } from "@/scripts/metrics-compact.mjs";

const NOW = new Date("2024-01-05T00:00:00.000Z").getTime();

describe("metrics-compact script", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("merges chunk files and filters erased identifiers", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "metrics-compact-"));
    const baseFile = path.join(tempDir, "vitals.ndjson");
    await writeFile(baseFile, "", "utf8");

    const keepLine = JSON.stringify({
      snapshotId: "flag/ns",
      metric: "CLS",
      value: 0.1,
      ts: NOW,
      sid: "sid-keep",
    });
    const removeLine = JSON.stringify({
      snapshotId: "flag/ns",
      metric: "CLS",
      value: 0.9,
      ts: NOW,
      sid: "sid-remove",
    });

    await writeFile(
      path.join(tempDir, "vitals-20240102.ndjson"),
      `${keepLine}\n${removeLine}\n`,
      "utf8",
    );
    await writeFile(path.join(tempDir, "vitals-20240102-1.ndjson"), `${keepLine}\n`, "utf8");
    await writeFile(path.join(tempDir, "vitals-20231201.ndjson"), `${keepLine}\n`, "utf8");

    const matcher = {
      hasAny: () => true,
      isErased: (candidate: { sid?: string | null }) => candidate.sid === "sid-remove",
    };

    const result = await compactTarget(baseFile, {
      retentionDays: 30,
      matcher,
      now: NOW,
    });

    expect(result.removedCount).toBe(1);
    expect(result.rewritten).toHaveLength(1);
    expect(result.rewritten[0]).toMatchObject({ kept: 2, removed: 1 });

    const mergedContent = await readFile(path.join(tempDir, "vitals-20240102.ndjson"), "utf8");
    const lines = mergedContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines.every((entry) => entry.sid === "sid-keep")).toBe(true);

    await expect(access(path.join(tempDir, "vitals-20240102-1.ndjson"))).rejects.toThrow();
    await expect(access(path.join(tempDir, "vitals-20231201.ndjson"))).rejects.toThrow();
  });
});
