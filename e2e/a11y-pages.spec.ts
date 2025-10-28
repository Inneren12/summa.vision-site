import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { acceptKlaroConsent } from "./support/consent";

const auditedRoutes = [
  { path: "/", description: "home" },
  { path: "/healthz", description: "health check" },
];

test.describe("critical routes accessibility", () => {
  for (const route of auditedRoutes) {
    test(`${route.path} has no serious accessibility issues`, async ({ page }) => {
      await page.goto(route.path);
      await acceptKlaroConsent(page);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      await test.info().attach(`axe-${route.description}`, {
        body: JSON.stringify(accessibilityScanResults, null, 2),
        contentType: "application/json",
      });

      const serious = accessibilityScanResults.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(serious).toEqual([]);
    });
  }
});
