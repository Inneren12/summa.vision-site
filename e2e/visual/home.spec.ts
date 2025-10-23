import { test, expect } from "@playwright/test";

test("home matches baseline", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("home.png", { maxDiffPixelRatio: 0.01 });
});
