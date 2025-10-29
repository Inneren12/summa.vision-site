import { expect, test } from "../fixtures";

test("atoms matches baseline", async ({ page }) => {
  await page.goto("/atoms");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("atoms.png", { maxDiffPixelRatio: 0.01 });
});
