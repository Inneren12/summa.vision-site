import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("env validation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_NAME: "Summa Vision",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails when required public vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_APP_NAME;

    await expect(import("./env")).rejects.toThrow(/NEXT_PUBLIC_APP_NAME/);
  });

  it("fails when public API base URL is not a valid URL", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "not-a-url";

    await expect(import("./env")).rejects.toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("fails when public site URL is not a valid URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "";

    await expect(import("./env")).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("passes with sample values", async () => {
    const importedEnv = await import("./env");

    expect(importedEnv.env.NEXT_PUBLIC_APP_NAME).toBe("Summa Vision");
    expect(importedEnv.env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:3000");
    expect(importedEnv.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(importedEnv.env.NODE_ENV).toBe("test");
  });
});
