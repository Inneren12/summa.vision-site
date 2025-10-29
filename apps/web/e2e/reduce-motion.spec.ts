import { test, expect } from "@playwright/test";

const SELS = ['section[role="region"], section', "table"];

test("reduce-motion disables animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const primaryUrl = "/dashboards/demo";
  const fallbackUrl = "/demo";
  const response = await page.goto(primaryUrl);
  if (!response || response.status() >= 400) {
    await page.goto(fallbackUrl);
  }
  await page.waitForLoadState("domcontentloaded");

  for (const sel of SELS) {
    const nodes = page.locator(sel);
    await expect(nodes).not.toHaveCount(0);
    const el = nodes.first();
    await expect(el).toBeVisible();
    const hasAnim = await el.evaluate((node) => {
      const s = window.getComputedStyle(node as Element);
      const ad = s.animationDuration.split(",").some((v) => parseFloat(v) > 0);
      const td = s.transitionDuration.split(",").some((v) => parseFloat(v) > 0);
      return ad || td;
    });
    expect(hasAnim).toBeFalsy();
  }
});
