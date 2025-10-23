import { test, expect } from "@playwright/test";

test("atoms matches baseline", async ({ page }) => {
  await page.goto("http://localhost:3000/atoms");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("atoms.png", { maxDiffPixelRatio: 0.01 });
});
