import { describe, it, expect } from "vitest";

import { getServerEnv, __resetServerEnvCacheForTests } from "../lib/env.server";

describe("server env validation", () => {
  it("accepts valid server env", () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "local";
    __resetServerEnvCacheForTests();
    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("test");
    expect(env.APP_ENV).toBe("local");
  });

  it("rejects invalid APP_ENV", () => {
    process.env.APP_ENV = "weird";
    __resetServerEnvCacheForTests();
    expect(() => getServerEnv()).toThrowError();
    // cleanup
    process.env.APP_ENV = "local";
    __resetServerEnvCacheForTests();
  });
});
