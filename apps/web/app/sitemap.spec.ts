import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("sitemap route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_NAME: "Summa Vision",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_URL: "https://summa.test",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("lists the homepage entry", async () => {
    const sitemap = (await import("./sitemap")).default;

    const entries = sitemap();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/"))).toBe(true);
  });
});
