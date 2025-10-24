import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { perfGet, perfReset } from "@/lib/ff/perf";
import { getFeatureFlags, __resetEnvCache } from "@/lib/ff/server";

const SAVED = { ...process.env };

function restoreEnv() {
  const envRecord = process.env as Record<string, string | undefined>;
  for (const key of Object.keys(envRecord)) {
    if (!(key in SAVED)) {
      delete envRecord[key];
    }
  }
  Object.assign(envRecord, SAVED);
}

describe("ENV cache reset", () => {
  beforeEach(() => {
    restoreEnv();
    perfReset(["ff.env.parse"]);
  });

  afterEach(() => {
    restoreEnv();
    perfReset();
  });

  it("re-parses after explicit reset", async () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ betaUI: true });
    await getFeatureFlags();
    expect(perfGet("ff.env.parse")).toBe(1);
    __resetEnvCache();
    await getFeatureFlags();
    expect(perfGet("ff.env.parse")).toBe(2);
  });
});
