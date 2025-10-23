import { test, expect } from "@playwright/test";

test("healthz matches baseline", async ({ page }) => {
  await page.goto("http://localhost:3000/healthz");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("healthz.png", { maxDiffPixelRatio: 0.01 });
});
