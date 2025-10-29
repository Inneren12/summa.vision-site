import { expect, test } from "../fixtures";

test("home matches baseline", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("home.png", { maxDiffPixelRatio: 0.01 });
});
