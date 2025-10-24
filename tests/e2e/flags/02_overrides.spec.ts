import { expect, test } from "@playwright/test";

import { clearLocalFlags, writeLocalFlags } from "./utils";

test.describe("Overrides via /api/ff-override", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await clearLocalFlags();
  });

  test("Boolean override forces result and persists across reloads", async ({ page }) => {
    await writeLocalFlags({
      betaUI: false,
      newCheckout: { enabled: true, percent: 0 },
    });
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="beta-ssr-on"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="beta-csr-on"]')).toHaveCount(0);

    await page.goto("/api/ff-override?ff=betaUI:true");
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="beta-ssr-on"]')).toBeVisible();
    await expect(page.locator('[data-testid="beta-csr-on"]')).toBeVisible();

    await page.goto("/api/ff-override?ff=betaUI:null");
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="beta-ssr-on"]')).toHaveCount(0);
  });
});
