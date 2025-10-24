import { describe, it, expect } from "vitest";

import { getPublicConfig } from "../lib/config/client";

describe("PublicConfig (typed, layered)", () => {
  it("resolves from NEXT_PUBLIC_* and applies defaults", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    process.env.NEXT_PUBLIC_DEV_TOOLS = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    const cfg = getPublicConfig();
    expect(cfg.appEnv).toBe("development");
    expect(cfg.devTools).toBe(true);
    expect(cfg.siteUrl).toBe("https://example.com");
  });

  it("does not include any private keys", () => {
    const cfg = getPublicConfig();
    // гарантируем, что приватные поля не "просачиваются"
    expect("databaseUrl" in cfg).toBe(false);
    expect("internalApiBase" in cfg).toBe(false);
  });
});
