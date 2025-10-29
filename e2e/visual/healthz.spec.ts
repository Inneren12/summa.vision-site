import { expect, test } from "../fixtures";

test("healthz matches baseline", async ({ page }) => {
  await page.goto("/healthz");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("healthz.png", { maxDiffPixelRatio: 0.01 });
});
