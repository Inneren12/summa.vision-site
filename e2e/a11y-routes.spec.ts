import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { acceptKlaroConsent } from "./support/consent";

type RouteConfig = {
  path: string;
  label: string;
  exclude?: string[];
};

const ROUTES: RouteConfig[] = [
  { path: "/", label: "home" },
  {
    path: "/story?slug=demo",
    label: "story-demo",
    exclude: [".bg-primary", '[data-test-id="story-demo-toolbar"]'],
  },
  { path: "/dashboards/demo", label: "dashboard-demo" },
];

test.describe("key routes accessibility", () => {
  for (const route of ROUTES) {
    test(`${route.path} has no serious accessibility issues`, async ({ page }) => {
      await page.goto(route.path);
      await acceptKlaroConsent(page);

      let builder = new AxeBuilder({ page });
      for (const selector of route.exclude ?? []) {
        builder = builder.exclude(selector);
      }

      const accessibilityScanResults = await builder.analyze();

      await test.info().attach(`axe-${route.label}.json`, {
        body: JSON.stringify(accessibilityScanResults, null, 2),
        contentType: "application/json",
      });

      const seriousViolations = accessibilityScanResults.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
    });
  }
});
