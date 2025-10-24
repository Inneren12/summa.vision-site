import { expect, test } from "@playwright/test";

import { clearLocalFlags, writeLocalFlags } from "./utils";

test.describe("Flags E2E - basic visibility", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await clearLocalFlags();
  });

  test("No ENV & no cookies -> blocks are hidden", async ({ page }) => {
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="beta-ssr-on"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="newcheckout-ssr-on"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="beta-csr-on"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="newcheckout-csr-on"]')).toHaveCount(0);
  });

  test("Dev-local flags emulate ENV: SSR/CSR visible", async ({ page }) => {
    await writeLocalFlags({
      betaUI: true,
      newCheckout: { enabled: true, percent: 100 },
    });
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="beta-ssr-on"]')).toBeVisible();
    await expect(page.locator('[data-testid="newcheckout-ssr-on"]')).toBeVisible();
    await expect(page.locator('[data-testid="beta-csr-on"]')).toBeVisible();
    await expect(page.locator('[data-testid="newcheckout-csr-on"]')).toBeVisible();
  });
});
