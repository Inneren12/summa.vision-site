import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvCache, getEnv, loadEnv } from "@/lib/env/load";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete (process.env as Record<string, string | undefined>)[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("env/load", () => {
  beforeEach(() => {
    restoreEnv();
    __resetEnvCache();
  });

  afterEach(() => {
    restoreEnv();
    __resetEnvCache();
  });

  it("parses and normalizes environment values", () => {
    process.env.NODE_ENV = "development";
    process.env.ADMIN_TOKENS = "admin-token";
    process.env.FF_COOKIE_DOMAIN = ".example.test";
    process.env.FF_COOKIE_PATH = "/flags";
    process.env.FF_COOKIE_SECURE = "true";
    process.env.REDIS_URL = "redis://localhost:6379/0";
    process.env.ROLLOUT_LOCK_TTL_MS = "2000";
    process.env.METRICS_WINDOW_MS = "60000";
    process.env.METRICS_ROTATE_MAX_MB = "64";
    process.env.METRICS_ROTATE_DAYS = "10";
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";

    const env = loadEnv();

    expect(env.NODE_ENV).toBe("development");
    expect(env.ADMIN_TOKENS).toBe("admin-token");
    expect(env.FF_COOKIE_DOMAIN).toBe(".example.test");
    expect(env.FF_COOKIE_PATH).toBe("/flags");
    expect(env.FF_COOKIE_SECURE).toBe(true);
    expect(env.REDIS_URL).toBe("redis://localhost:6379/0");
    expect(env.ROLLOUT_LOCK_TTL_MS).toBe(2000);
    expect(env.METRICS_WINDOW_MS).toBe(60000);
    expect(env.METRICS_ROTATE_MAX_MB).toBe(64);
    expect(env.METRICS_ROTATE_DAYS).toBe(10);
    expect(env.NEXT_PUBLIC_DEV_TOOLS).toBe(true);
  });

  it("throws in production when required keys are missing", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKENS = "admin";
    process.env.FF_COOKIE_PATH = "/";
    process.env.FF_COOKIE_SECURE = "false";

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => loadEnv()).toThrow(/FF_COOKIE_DOMAIN/);

    warn.mockRestore();
  });

  it("reloads values after cache reset", () => {
    process.env.ADMIN_TOKENS = "alpha";
    process.env.FF_COOKIE_PATH = "/flags";
    process.env.FF_COOKIE_SECURE = "true";

    __resetEnvCache();
    expect(getEnv().FF_COOKIE_PATH).toBe("/flags");

    process.env.FF_COOKIE_PATH = "/new";
    process.env.FF_COOKIE_SECURE = "false";
    __resetEnvCache();

    const env = getEnv();
    expect(env.FF_COOKIE_PATH).toBe("/new");
    expect(env.FF_COOKIE_SECURE).toBe(false);
  });
});
