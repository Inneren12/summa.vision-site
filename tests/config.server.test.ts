import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getAppConfig } from "../lib/config/server";
import { __resetServerEnvCacheForTests } from "../lib/env.server";

const savedEnv = { ...process.env };

describe("ServerConfig (typed, layered)", () => {
  beforeEach(() => {
    Object.assign(process.env, savedEnv);
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "local";
    delete process.env.INTERNAL_API_BASE;
    delete process.env.DATABASE_URL;
    delete process.env.ENABLE_CSP;
    __resetServerEnvCacheForTests();
  });

  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      Reflect.deleteProperty(process.env, k as keyof NodeJS.ProcessEnv);
    });
    Object.assign(process.env, savedEnv);
    __resetServerEnvCacheForTests();
  });

  it("applies defaults and parses ENV", () => {
    process.env.INTERNAL_API_BASE = "http://localhost:3000";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    process.env.ENABLE_CSP = "false";
    __resetServerEnvCacheForTests();
    const cfg = getAppConfig();
    expect(cfg.nodeEnv).toBe("test");
    expect(cfg.appEnv).toBe("local");
    expect(cfg.internalApiBase).toBe("http://localhost:3000");
    expect(cfg.databaseUrl).toContain("postgres://");
    expect(cfg.enableCsp).toBe(false);
  });

  it("validates APP_ENV from ENV", () => {
    process.env.APP_ENV = "staging";
    const cfg = getAppConfig();
    expect(cfg.appEnv).toBe("staging");
  });
});
