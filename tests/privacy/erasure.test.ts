import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  appendErasureRecord,
  buildErasureIndex,
  isIdentifierErased,
  loadErasureIndex,
  purgeNdjsonFile,
  summarizeIdentifiers,
} from "@/lib/privacy/erasure";

describe("privacy erasure registry", () => {
  let tmpDir: string;
  let erasureFile: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "privacy-erasure-"));
    erasureFile = path.join(tmpDir, "privacy.erasure.ndjson");
    process.env.PRIVACY_ERASURE_FILE = erasureFile;
  });

  afterEach(async () => {
    delete process.env.PRIVACY_ERASURE_FILE;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("appends erasure entries and loads index", async () => {
    await appendErasureRecord(
      { sid: "sid-1" },
      { filePath: erasureFile, timestamp: 1000, source: "self" },
    );
    await appendErasureRecord(
      { aid: "aid-2", userId: "user-9" },
      { filePath: erasureFile, timestamp: 2000, source: "admin" },
    );

    const entries = await readFile(erasureFile, "utf8");
    expect(entries.trim().split(/\n/)).toHaveLength(2);

    const index = await loadErasureIndex(erasureFile);
    expect(index.entries).toHaveLength(2);
    expect(isIdentifierErased(index, { sid: "sid-1" })).toBe(true);
    expect(isIdentifierErased(index, { aid: "aid-2" })).toBe(true);
    expect(isIdentifierErased(index, { userId: "user-9" })).toBe(true);
    const snapshot = buildErasureIndex(index.entries);
    expect(summarizeIdentifiers(snapshot.entries[1])).toEqual({
      sid: undefined,
      aid: "aid-2",
      userId: "user-9",
    });
  });

  it("purges matching entries from ndjson files when under threshold", async () => {
    const file = path.join(tmpDir, "vitals.ndjson");
    const lines = [
      { sid: "sid-keep", metric: "INP", value: 100 },
      { sid: "sid-remove", metric: "INP", value: 200 },
      { aid: "aid-remove", metric: "CLS", value: 0.1 },
    ];
    await writeFile(file, lines.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");

    const summary = await purgeNdjsonFile(
      file,
      { sid: "sid-remove", aid: "aid-remove" },
      { thresholdBytes: 1024 },
    );
    expect(summary.purged).toBe(true);
    expect(summary.removed).toBe(2);

    const content = await readFile(file, "utf8");
    const remaining = content
      .trim()
      .split(/\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sid).toBe("sid-keep");
  });

  it("skips purging when file is larger than threshold", async () => {
    const file = path.join(tmpDir, "large.ndjson");
    const payload = "{}\n".repeat(10);
    await writeFile(file, payload, "utf8");

    const summary = await purgeNdjsonFile(file, { sid: "sid-any" }, { thresholdBytes: 1 });
    expect(summary.skipped).toBe(true);
    expect(summary.reason).toBe("over_threshold");

    const snapshot = await readFile(file, "utf8");
    expect(snapshot).toBe(payload);
  });
});
