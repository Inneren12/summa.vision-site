import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("robots route", () => {
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

  it("includes sitemap location", async () => {
    const robots = (await import("./robots")).default;

    const result = robots();

    expect(result.rules?.[0]?.userAgent).toBe("*");
    expect(result.sitemap).toContain("sitemap.xml");
  });
});
