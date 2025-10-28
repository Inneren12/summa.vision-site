import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { acceptKlaroConsent } from "./support/consent";

test("home has no serious accessibility issues", async ({ page }) => {
  await page.goto("/");
  await acceptKlaroConsent(page);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const serious = accessibilityScanResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(serious).toEqual([]);
});
