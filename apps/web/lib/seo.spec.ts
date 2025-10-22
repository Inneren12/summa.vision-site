import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("SEO helpers", () => {
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

  it("merges defaults and canonical", async () => {
    const { buildMetadata, siteMeta } = await import("./seo");

    const metadata = buildMetadata({ title: "Custom" });

    expect(metadata.title).toBe("Custom");
    expect(metadata.alternates?.canonical).toBe(siteMeta.siteUrl);
    expect(metadata.openGraph?.siteName).toBe(siteMeta.siteName);
    expect(metadata.openGraph?.title).toBe("Custom");
  });

  it("serialises json-ld payloads", async () => {
    const { jsonLd } = await import("./seo");

    expect(jsonLd({ foo: "bar" })).toEqual({ __html: '{"foo":"bar"}' });
  });
});
