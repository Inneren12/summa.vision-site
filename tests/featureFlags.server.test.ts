import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { it, expect, beforeEach, afterEach } from "vitest";

import { __resetServerEnvCacheForTests } from "../lib/env.server";
import { getFeatureFlags, getFlag } from "../lib/ff/server";

const tmpPrefix = path.join(os.tmpdir(), "ff-test-");
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpPrefix);
  process.env.FEATURE_FLAGS_LOCAL_PATH = path.join(tmpDir, "feature-flags.local.json");
  process.env.NODE_ENV = "development";
  delete process.env.FEATURE_FLAGS_JSON;
  delete process.env.NEXT_RUNTIME;
  __resetServerEnvCacheForTests();
});

afterEach(async () => {
  delete process.env.FEATURE_FLAGS_LOCAL_PATH;
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.FEATURE_FLAGS_JSON;
  __resetServerEnvCacheForTests();
});

it("merges dev-local file and ENV(JSON); ENV wins", async () => {
  await fs.writeFile(
    process.env.FEATURE_FLAGS_LOCAL_PATH!,
    JSON.stringify({ a: true, b: "local", c: 1 }),
    "utf8",
  );
  process.env.FEATURE_FLAGS_JSON = JSON.stringify({ b: "env", d: false });

  const flags = await getFeatureFlags();
  expect(flags).toEqual({ a: true, b: "env", c: 1, d: false });

  const b = await getFlag<string>("b");
  expect(b).toBe("env");
});

it("returns empty when no sources present", async () => {
  const flags = await getFeatureFlags();
  expect(flags).toEqual({});
});

it("ignores dev-local file in production", async () => {
  await fs.writeFile(
    process.env.FEATURE_FLAGS_LOCAL_PATH!,
    JSON.stringify({ devOnly: true }),
    "utf8",
  );
  process.env.NODE_ENV = "production";
  const flags = await getFeatureFlags();
  expect(flags).toEqual({});
});

it("accepts structured rollout value in ENV (union type)", async () => {
  process.env.FEATURE_FLAGS_JSON = JSON.stringify({
    newCheckout: { enabled: true, percent: 15, salt: "cohort1" },
    msg: "x",
    n: 3,
    on: true,
  });
  const flags = await getFeatureFlags();
  expect(flags.newCheckout).toEqual({ enabled: true, percent: 15, salt: "cohort1" });
  expect(flags.msg).toBe("x");
  expect(flags.n).toBe(3);
  expect(flags.on).toBe(true);
});
