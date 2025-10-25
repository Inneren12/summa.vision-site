import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { compactPrivacyTarget } from "@/scripts/privacy-compact.mjs";

const NOW = new Date("2024-01-05T00:00:00.000Z").getTime();

describe("privacy-compact script", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("filters active file and chunk data using erasure registry", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "privacy-compact-"));
    const baseFile = path.join(tempDir, "vitals.ndjson");
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

    await writeFile(baseFile, `${keepLine}\n${removeLine}\n`, "utf8");
    await writeFile(
      path.join(tempDir, "vitals-20240102.ndjson"),
      `${keepLine}\n${removeLine}\n`,
      "utf8",
    );
    await writeFile(path.join(tempDir, "vitals-20231201.ndjson"), `${keepLine}\n`, "utf8");

    const matcher = {
      hasAny: () => true,
      isErased: (candidate: { sid?: string | null }) => candidate.sid === "sid-remove",
    };

    const result = await compactPrivacyTarget(baseFile, {
      retentionDays: 30,
      matcher,
      now: NOW,
    });

    expect(result.summary.removedCount).toBe(1);
    expect(result.summary.rewritten).toHaveLength(1);
    expect(result.active.filtered).toBe(true);
    expect(result.active.removed).toBe(1);

    const baseContent = await readFile(baseFile, "utf8");
    const baseLines = baseContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(baseLines).toHaveLength(1);
    expect(baseLines[0]).toMatchObject({ sid: "sid-keep" });

    const chunkContent = await readFile(path.join(tempDir, "vitals-20240102.ndjson"), "utf8");
    const chunkLines = chunkContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(chunkLines).toHaveLength(1);
    expect(chunkLines[0]).toMatchObject({ sid: "sid-keep" });

    await expect(access(path.join(tempDir, "vitals-20231201.ndjson"))).rejects.toThrow();
  });
});
