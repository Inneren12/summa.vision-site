import { describe, it, expect } from "vitest";

import robots from "./robots";

describe("robots", () => {
  it("has sitemap link", () => {
    const r = robots();
    const sitemapList = r.sitemap ? (Array.isArray(r.sitemap) ? r.sitemap : [r.sitemap]) : [];
    expect(sitemapList.length).toBeGreaterThan(0);
    expect(String(sitemapList[0])).toMatch(/sitemap\.xml$/);
  });

  it("rules are assertable as array", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toBeDefined();
    const ua = rules[0]?.userAgent;
    const firstUA = Array.isArray(ua) ? ua[0] : ua;
    expect(firstUA && String(firstUA).length).toBeGreaterThan(0);
  });
});
